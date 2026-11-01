/**
 * Etterkontroll: spørsmål som er koblet til primærdata (binding) kontrolleres på nytt når
 * tabellen er oppdatert. Avvik over toleransen sender spørsmålet til manuell gjennomgang og
 * fjerner det fra kommende (ikke låste) runder.
 */
import type { Db } from "../db/client";
import type { SsbClient } from "./ssb/client";
import { resolveSelection, type SelectionRule } from "./selection";
import type { QuestionContent } from "../game/schema";
import { setQuestionStatus } from "../db/questions";
import { regenerateDailyGame } from "../db/games";
import { localDate } from "../game/dates";

export interface RevalidationResult {
  questionId: string;
  ok: boolean;
  expected: number[];
  actual: number[];
  action: "none" | "review_required" | "error";
  message?: string;
}

export function expectedValues(q: QuestionContent): number[] {
  const p = q.payload;
  const target = q.binding?.target;
  if (target === "items" && (p.format === "compare" || p.format === "rank")) return p.items.map((i) => i.value);
  if (target === "answer" && p.format === "estimate") return [p.answer];
  if (target === "last" && p.format === "trend") return [p.series[p.series.length - 1].value];
  return [];
}

export async function revalidateQuestion(db: Db, client: SsbClient, row: { id: string; status: string; content: QuestionContent }): Promise<RevalidationResult> {
  const q = row.content;
  const b = q.binding!;
  try {
    const meta = await client.getMetadata(b.tableId);
    const rules: Record<string, SelectionRule> = {};
    for (const d of meta.dimensions) {
      if (b.selection[d.id]) rules[d.id] = { kind: "codes", codes: b.selection[d.id] };
      else rules[d.id] = b.transform === "sum" ? { kind: "all" } : { kind: "total" };
    }
    // ContentsCode: velg første statistikkvariabel hvis ikke angitt.
    const metric = meta.roles.metric ?? "ContentsCode";
    if (!b.selection[metric] && meta.dimensions.some((d) => d.id === metric)) rules[metric] = { kind: "first" };
    const selection = resolveSelection(meta.dimensions, rules);
    const { data } = await client.getData(b.tableId, selection);
    const groupDim = Object.keys(b.selection).find((k) => b.selection[k].length > 1) ?? Object.keys(b.selection)[0];
    const groups = b.selection[groupDim] ?? [];
    const actual = groups.map((code) =>
      data.observations.filter((o) => o.dims[groupDim] === code && o.value !== null).reduce((s, o) => s + (o.value as number), 0),
    );
    const expected = expectedValues(q);
    const ok = expected.length === actual.length && expected.every((e, i) => Math.abs(e - actual[i]) <= Math.abs(e) * b.toleranceRel + 1e-9);
    if (ok) {
      await db.query(`UPDATE questions SET last_verified_at = $2, qa = qa || $3::jsonb WHERE id = $1`, [row.id, localDate(), JSON.stringify({ revalidatedAt: new Date().toISOString() })]);
      return { questionId: row.id, ok, expected, actual, action: "none" };
    }
    if (["approved", "published"].includes(row.status)) {
      await setQuestionStatus(db, row.id, "review_required", "pipeline", `Data revidert/endret: forventet ${expected.join(", ")}, fikk ${actual.join(", ")}`);
      await pullFromUpcoming(db, row.id);
    }
    return { questionId: row.id, ok, expected, actual, action: "review_required" };
  } catch (err) {
    return { questionId: row.id, ok: false, expected: expectedValues(q), actual: [], action: "error", message: (err as Error).message };
  }
}

/** Fjerner et spørsmål fra fremtidige, ulåste runder ved å generere dem på nytt. */
export async function pullFromUpcoming(db: Db, questionId: string): Promise<string[]> {
  const games = await db.query<{ game_date: string }>(
    `SELECT game_date FROM games WHERE kind = 'daily' AND locked_at IS NULL AND game_date > $1 AND question_ids ? $2`,
    [localDate(), questionId],
  );
  const redone: string[] = [];
  for (const g of games) {
    try {
      await regenerateDailyGame(db, g.game_date);
      redone.push(g.game_date);
    } catch {
      /* runder med spillere låses og beholdes; spørsmålet filtreres da bort ved servering hvis arkivert */
    }
  }
  return redone;
}
