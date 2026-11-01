/**
 * Ukentlig produksjonssyklus (kjøres av GitHub Actions – ikke avhengig av noens PC):
 *  1. Finn nye og reviderte SSB-tabeller      6. Ranger kandidatene
 *  2. Oppdater datalageret (versjonert)       7. Legg dem i godkjenningskøen
 *  3. Finn interessante funn (deterministisk) 8. Publiser godkjent innhold etter reglene
 *  4. Lag spørsmålskandidater (mal + Claude)  9. Sett sammen kommende daglige runder
 *  5. Faktakontroll                           10. Lag produksjonsrapport (+ varsling ved feil)
 */
import type { Db } from "../db/client";
import { CATALOG, type CatalogEntry } from "../data/catalog";
import { SsbClient } from "../data/ssb/client";
import { ingestEntry, type IngestResult } from "../data/ingest";
import { analyze, type Finding } from "../data/analysis";
import { produceCandidates, type CandidateResult } from "../editorial/pipeline";
import { createClaudeEditor, templateOnlyEditor, type EditorialClient } from "../editorial/claude";
import { revalidateQuestion, type RevalidationResult } from "../data/revalidate";
import { scheduleUpcoming } from "../db/games";
import { getSettings } from "../db/settings";
import { addDays, localDate } from "../game/dates";
import type { QuestionContent } from "../game/schema";
import type { ParsedDataset } from "../data/ssb/jsonstat";
import { recalibratePriorities } from "../analytics/dashboard";

export interface WeeklyOptions {
  client?: SsbClient | null;
  editor?: EditorialClient;
  force?: boolean;
  catalog?: CatalogEntry[];
  /** Kun tester/demo: syntetiske datasett per katalognøkkel. */
  fixtures?: Record<string, { metadata: ParsedDataset; data: ParsedDataset; updated: string; synthetic: true }>;
  log?: (m: string) => void;
  today?: string;
  kind?: string;
}

export interface WeeklyReport {
  runId: number;
  status: "ok" | "partial" | "failed";
  discovered: { updatedTables: number; candidates: string[] };
  ingest: Omit<IngestResult, "data">[];
  findings: number;
  candidates: CandidateResult[];
  revalidation: RevalidationResult[];
  scheduled: string[];
  aiCostUsd: number;
  maintenance: { eventsDeleted: number };
  errors: string[];
  markdown: string;
}

const INTEREST = /befolkning|kommune|bolig|pris|lønn|inntekt|utdanning|sysselsett|navn|fødte|husdyr|jakt|bil|reise|kultur|medie|energi|avfall|tid/i;
const BIG_CITIES = ["4601", "5001", "1103", "3201"]; // Bergen, Trondheim, Stavanger, Bærum

export async function runWeekly(db: Db, opts: WeeklyOptions = {}): Promise<WeeklyReport> {
  const log = opts.log ?? ((m: string) => console.log(m));
  const today = opts.today ?? localDate();
  const errors: string[] = [];
  const settings = await getSettings(db);
  const run = await db.one<{ id: number }>(`INSERT INTO pipeline_runs (kind) VALUES ($1) RETURNING id`, [opts.kind ?? "weekly"]);
  const runId = run!.id;
  const client = opts.client === undefined ? new SsbClient({ log }) : opts.client;
  const catalog = opts.catalog ?? CATALOG;

  // 1. Oppdagelse
  const discovered = { updatedTables: 0, candidates: [] as string[] };
  if (client) {
    try {
      await client.loadConfig();
      log(`SSB-grenser: ${client.config.maxDataCells} celler, ${client.config.maxCallsPerTimeWindow} kall / ${client.config.timeWindow} s`);
      const updated = await client.listTables({ pastDays: 8 });
      discovered.updatedTables = updated.length;
      const watched = new Set(catalog.map((c) => c.tableId));
      for (const t of updated.filter((t) => !watched.has(t.id) && INTEREST.test(t.label)).slice(0, 40)) {
        await db.query(
          `INSERT INTO datasets (id, source_id, table_id, title, status, source_updated_at, metadata)
           VALUES ($1,'ssb',$2,$3,'candidate',$4,$5::jsonb) ON CONFLICT (id) DO UPDATE SET source_updated_at = EXCLUDED.source_updated_at, title = EXCLUDED.title`,
          [`ssb:${t.id}:kandidat`, t.id, t.label.slice(0, 300), t.updated ?? null, JSON.stringify({ firstPeriod: t.firstPeriod, lastPeriod: t.lastPeriod, variables: t.variableNames })],
        );
        discovered.candidates.push(`${t.id} ${t.label}`);
      }
    } catch (err) {
      errors.push(`Oppdagelse feilet: ${(err as Error).message}`);
    }
  }

  // 2. Innhenting
  const kommuner = new Set((await db.query<{ nr: string }>(`SELECT nr FROM kommuner`)).map((r) => r.nr));
  const geoLabels = new Map((await db.query<{ nr: string; name: string }>(`SELECT nr, name FROM kommuner`)).map((r) => [r.nr, r.name]));
  const population = new Map((await db.query<{ nr: string; population: number | null }>(`SELECT nr, population FROM kommuner`)).map((r) => [r.nr, r.population ?? 0]));
  const ingest: IngestResult[] = [];
  for (const entry of catalog) {
    const res = await ingestEntry(db, client, entry, { kommuner, force: opts.force, fixture: opts.fixtures?.[entry.key] });
    ingest.push(res);
    log(`Innhenting ${entry.key}: ${res.status}${res.error ? ` – ${res.error}` : ""}${res.revisions ? ` (${res.revisions} revisjoner)` : ""}`);
    if (res.status === "error") errors.push(`${entry.key}: ${res.error}`);
    if (res.structureChanged) errors.push(`${entry.key}: tabellstrukturen er endret – kontroller katalogen`);
  }

  // 3. Funn
  const findings: Finding[] = [];
  for (const res of ingest) {
    if (!res.data || (res.status !== "new_version" && !opts.force)) continue;
    const entry = catalog.find((c) => c.key === res.key)!;
    try {
      findings.push(
        ...analyze({ entry, data: res.data, queryUrl: res.queryUrl ?? "", sourceUpdated: res.sourceUpdated ?? null, geoLabels, population, bigCities: BIG_CITIES }),
      );
    } catch (err) {
      errors.push(`Analyse av ${res.key} feilet: ${(err as Error).message}`);
    }
  }
  log(`Funn: ${findings.length}`);

  // 4–7. Kandidater, faktakontroll, rangering og kø
  const monthStart = `${today.slice(0, 7)}-01`;
  const spentMonth = (await db.one<{ s: number }>(`SELECT COALESCE(sum(cost_usd),0)::float AS s FROM ai_usage WHERE created_at >= $1::date`, [monthStart]))?.s ?? 0;
  const budget = Math.max(0, Math.min(settings.aiRunBudgetUsd, settings.aiMonthlyBudgetUsd - spentMonth));
  const editor = opts.editor ?? (process.env.ANTHROPIC_API_KEY && budget > 0 ? createClaudeEditor() : templateOnlyEditor);
  if (!process.env.ANTHROPIC_API_KEY && !opts.editor) log("ANTHROPIC_API_KEY mangler – bruker bare deterministiske maler");
  const { results: candidates, spentUsd } = await produceCandidates(db, findings, editor, {
    today,
    runId,
    budgetUsd: budget,
    maxCandidates: settings.aiMaxCandidatesPerRun,
    log,
  });

  // Etterkontroll av spørsmål koblet til tabeller som ble oppdatert
  const revalidation: RevalidationResult[] = [];
  const updatedTables = new Set(ingest.filter((r) => r.status === "new_version").map((r) => r.datasetId.split(":")[1]));
  if (client && updatedTables.size) {
    const bound = await db.query<{ id: string; status: string; content: QuestionContent }>(
      `SELECT id, status, content FROM questions WHERE content ? 'binding' AND status IN ('approved','published','review_required')`,
    );
    for (const row of bound.filter((b) => updatedTables.has(b.content.binding!.tableId))) {
      const r = await revalidateQuestion(db, client, row);
      revalidation.push(r);
      if (r.action === "error") errors.push(`Etterkontroll ${r.questionId}: ${r.message}`);
    }
  }

  // Kalibrer prioriteringene mot faktisk bruk før nye runder settes sammen.
  const recalibrated = await recalibratePriorities(db).catch((err) => {
    errors.push(`Kalibrering feilet: ${(err as Error).message}`);
    return 0;
  });
  if (recalibrated) log(`Kalibrerte prioritet for ${recalibrated} spørsmål`);

  // 9. Kommende runder (14 dager)
  const scheduled = (await scheduleUpcoming(db, addDays(today, 1), 14)).map((g) => g.game_date ?? g.id);

  // Vedlikehold: dataminimering
  const del = await db.query<{ n: number }>(`WITH d AS (DELETE FROM events WHERE ts < now() - interval '13 months' RETURNING 1) SELECT count(*)::int AS n FROM d`);
  await db.query(`DELETE FROM rate_limits WHERE window_start < $1`, [Math.floor(Date.now() / 1000) - 86_400 * 2]);

  const status: WeeklyReport["status"] = errors.length === 0 ? "ok" : ingest.some((r) => r.status !== "error") ? "partial" : "failed";
  const report: WeeklyReport = {
    runId,
    status,
    discovered,
    ingest: ingest.map(({ data: _d, ...rest }) => rest),
    findings: findings.length,
    candidates,
    revalidation,
    scheduled,
    aiCostUsd: Math.round(spentUsd * 10000) / 10000,
    maintenance: { eventsDeleted: del[0]?.n ?? 0 },
    errors,
    markdown: "",
  };
  report.markdown = renderReport(report, today);
  await db.query(`UPDATE pipeline_runs SET finished_at = now(), status = $2, stats = $3::jsonb, report = $4, errors = $5::jsonb WHERE id = $1`, [
    runId,
    status,
    JSON.stringify({ ...report, markdown: undefined, candidates: candidates.length, findings: findings.length }),
    report.markdown,
    JSON.stringify(errors),
  ]);
  return report;
}

export function renderReport(r: WeeklyReport, today: string): string {
  const byStatus = r.candidates.reduce<Record<string, number>>((acc, c) => ((acc[c.status] = (acc[c.status] ?? 0) + 1), acc), {});
  const lines = [
    `# Produksjonsrapport ${today}`,
    ``,
    `Status: **${r.status.toUpperCase()}** · kjøring #${r.runId}`,
    ``,
    `## Data`,
    `- Tabeller oppdatert hos SSB siste 8 dager: ${r.discovered.updatedTables}`,
    `- Nye kandidattabeller til vurdering: ${r.discovered.candidates.length}`,
    ...r.ingest.map((i) => `- ${i.key}: ${i.status}${i.cells ? `, ${i.cells} celler` : ""}${i.revisions ? `, ${i.revisions} reviderte verdier` : ""}${i.suppressed ? `, ${i.suppressed} skjermet` : ""}${i.error ? ` – ${i.error}` : ""}`),
    ``,
    `## Innhold`,
    `- Funn: ${r.findings}`,
    `- Kandidater: ${r.candidates.length} (${Object.entries(byStatus).map(([k, v]) => `${k}: ${v}`).join(", ") || "ingen"})`,
    `- KI-kostnad denne kjøringen: $${r.aiCostUsd.toFixed(4)}`,
    `- Etterkontrollerte spørsmål: ${r.revalidation.length} (${r.revalidation.filter((x) => !x.ok).length} avvik)`,
    `- Planlagte runder: ${r.scheduled.length ? `${r.scheduled[0]} – ${r.scheduled[r.scheduled.length - 1]}` : "ingen (for få godkjente spørsmål?)"}`,
    `- Slettede hendelser eldre enn 13 måneder: ${r.maintenance.eventsDeleted}`,
    ``,
    `## Feil og varsler`,
    ...(r.errors.length ? r.errors.map((e) => `- ⚠ ${e}`) : ["- Ingen"]),
  ];
  return lines.join("\n");
}

/** Varsling ved kritiske feil (Slack-kompatibel webhook). */
export async function alert(text: string): Promise<void> {
  const url = process.env.ALERT_WEBHOOK_URL;
  if (!url) return;
  try {
    await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text }) });
  } catch {
    /* varsling skal aldri velte jobben */
  }
}
