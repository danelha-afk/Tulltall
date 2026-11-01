/**
 * Redaksjonell produksjonslinje: funn → utkast → (KI-forbedring) → deterministisk faktakontroll
 * → rangering → status (godkjenningskø eller automatisk godkjenning etter strenge regler).
 */
import type { Db } from "../db/client";
import type { Finding } from "../data/analysis";
import { allowedNumbersFor } from "../data/analysis";
import { draftsFromFinding, type Draft } from "./templates";
import type { Editorial, EditorialClient } from "./claude";
import { parseQuestion, type QuestionContent, type QuestionStatus, type Risk } from "../game/schema";
import { validateQuestion } from "../qa/validate";
import { saveQuestion } from "../db/questions";
import { getSettings } from "../db/settings";

const RISK_ORDER: Record<Risk, number> = { low: 0, medium: 1, high: 2 };
/** Maler som er forhåndsgodkjent for automatisk publisering av lavrisiko-innhold. */
export const AUTO_APPROVABLE_TEMPLATES = new Set(["rivalry-compare", "rank-cities"]);

export function applyEditorial(draft: Draft, ed: Editorial | null): unknown {
  if (!ed) return draft.question;
  const q = draft.question;
  const risk = RISK_ORDER[ed.suggestedRisk] > RISK_ORDER[q.risk] ? ed.suggestedRisk : q.risk;
  return {
    ...q,
    risk,
    tone: risk === "high" ? "serious" : ed.tone,
    kicker: ed.kicker.slice(0, 40),
    prompt: ed.prompt.slice(0, 200),
    shareText: ed.shareText.slice(0, 160),
    reveal: {
      headline: ed.headline.slice(0, 140),
      explanation: ed.explanation.slice(0, 600),
      deepDive: ed.deepDive ? ed.deepDive.slice(0, 1600) : risk === "high" ? "Tallene må leses med forsiktighet. Se kilden for metode og definisjoner." : undefined,
      caveats: [...new Set([...(q.reveal.caveats ?? []), ...ed.caveats.map((c) => c.slice(0, 300))])].slice(0, 4),
    },
  };
}

/** Intern prioritet 0–1. Bevisst enkel og forklarbar; kalibreres senere mot faktisk bruk. */
export function priorityScore(f: Finding, ed: Editorial | null): number {
  const h = f.heuristics;
  const det = 0.3 * h.surprise + 0.2 * h.recognizability + 0.15 * h.competition + 0.15 * h.visual + 0.2 * h.dataQuality;
  if (!ed) return Math.round(det * 100) / 100;
  const s = ed.scores;
  const ai = (s.surprise + s.recognizability + s.socialRelevance + s.humor + s.competition + s.enlightenment + s.visual + s.shareability) / 40;
  return Math.round((0.6 * det + 0.4 * ai) * 100) / 100;
}

export interface CandidateResult {
  questionId: string;
  status: QuestionStatus | "rejected";
  template: string;
  priority: number;
  errors: string[];
  flags: string[];
  aiCostUsd: number;
}

export async function produceCandidates(
  db: Db,
  findings: Finding[],
  editor: EditorialClient,
  opts: { today: string; runId?: number; budgetUsd: number; maxCandidates: number; log?: (m: string) => void },
): Promise<{ results: CandidateResult[]; spentUsd: number }> {
  const settings = await getSettings(db);
  const existing = (await db.query<{ id: string; prompt: string }>(`SELECT id, content->>'prompt' AS prompt FROM questions`)).map((r) => ({ id: r.id, prompt: r.prompt }));
  const known = new Set(existing.map((e) => e.id));
  const results: CandidateResult[] = [];
  let spent = 0;

  // Mest lovende funn først.
  const ranked = [...findings].sort((a, b) => priorityScore(b, null) - priorityScore(a, null));
  for (const f of ranked) {
    if (results.length >= opts.maxCandidates) break;
    const done = await db.one(`SELECT 1 FROM findings WHERE id = $1 AND status IN ('drafted','discarded','used')`, [f.id]);
    if (done) continue;
    for (const draft of draftsFromFinding(f, opts.today)) {
      if (known.has(draft.question.id)) continue;
      let editorial: Editorial | null = null;
      let cost = 0;
      if (spent < opts.budgetUsd) {
        const res = await editor.enhance(f, draft);
        cost = res.costUsd;
        spent += cost;
        editorial = res.editorial;
        if (res.model !== "none") {
          await db.query(
            `INSERT INTO ai_usage (run_id, model, purpose, input_tokens, output_tokens, cost_usd, ok) VALUES ($1,$2,'editorial',$3,$4,$5,$6)`,
            [opts.runId ?? null, res.model, res.inputTokens, res.outputTokens, cost, !res.error],
          );
        }
        if (res.error) opts.log?.(`KI-feil for ${draft.question.id}: ${res.error}`);
      }
      if (editorial && !editorial.include) {
        results.push({ questionId: draft.question.id, status: "rejected", template: draft.template, priority: 0, errors: ["KI-redaksjonen vurderte funnet som uegnet"], flags: [], aiCostUsd: cost });
        continue;
      }

      const candidate = applyEditorial(draft, editorial);
      const parsed = parseQuestion(candidate);
      if (!parsed.ok) {
        results.push({ questionId: draft.question.id, status: "rejected", template: draft.template, priority: 0, errors: parsed.errors, flags: [], aiCostUsd: cost });
        continue;
      }
      const q: QuestionContent = parsed.value;
      // Deterministisk kontroll – KI kan ikke overstyre denne.
      const qa = validateQuestion(q, { existing, today: opts.today, allowedNumbers: allowedNumbersFor(f), strictNumbers: true });
      const flags = [...qa.flags];
      if (editorial?.needsManualReview) flags.push(...editorial.reviewReasons.map((r) => `KI: ${r}`), "KI ba om manuell gjennomgang");
      if (f.guards.smallNumbers) flags.push("små tall");
      const priority = priorityScore(f, editorial);

      const synthetic = f.provenance.queryUrl.startsWith("fixture://");
      if (synthetic) flags.push("SYNTETISKE TESTDATA – kan aldri publiseres");

      let status: QuestionStatus;
      if (synthetic) status = qa.ok ? "validated" : "draft";
      else if (!qa.ok) status = "draft";
      else if (q.risk === "high" || qa.computedRisk === "high" || flags.length > 0) status = "review_required";
      else if (settings.autoPublishLowRisk && q.risk === "low" && AUTO_APPROVABLE_TEMPLATES.has(draft.template)) status = "approved";
      else status = "review_required";

      await db.query(
        `INSERT INTO findings (id, dataset_id, version_id, kind, payload, heuristics, status)
         SELECT $1, d.id, (SELECT id FROM dataset_versions WHERE dataset_id = d.id ORDER BY fetched_at DESC, id DESC LIMIT 1), $3, $4::jsonb, $5::jsonb, 'drafted'
         FROM datasets d WHERE d.catalog_key = $2 AND EXISTS (SELECT 1 FROM dataset_versions v WHERE v.dataset_id = d.id)
         ON CONFLICT (id) DO UPDATE SET status = 'drafted'`,
        [f.id, f.catalogKey, f.kind, JSON.stringify(f), JSON.stringify(f.heuristics)],
      );
      await saveQuestion(db, q, {
        status,
        actor: "pipeline",
        origin: "pipeline",
        note: `Mal ${draft.template}${editorial ? " + KI-forbedret" : ""}`,
        findingId: (await db.one(`SELECT id FROM findings WHERE id = $1`, [f.id])) ? f.id : null,
        qa: { ok: qa.ok, errors: qa.errors, warnings: qa.warnings, flags, checkedAt: new Date().toISOString() },
        scores: { ...(editorial?.scores ?? {}), priority },
      });
      existing.push({ id: q.id, prompt: q.prompt });
      known.add(q.id);
      results.push({ questionId: q.id, status, template: draft.template, priority, errors: qa.errors, flags, aiCostUsd: cost });
    }
  }
  return { results, spentUsd: spent };
}
