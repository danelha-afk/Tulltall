/**
 * Poengberegning. Kjøres alltid på serveren – klienten får aldri vite fasit før svaret er levert.
 * Hvert spørsmål gir 0–100 poeng. Et «treff» (stanset hull på billetten) er ≥ 70 poeng.
 */
import { z } from "zod";
import type { Payload } from "./schema";

export const HIT_THRESHOLD = 70;

export const AnswerSchema = z.discriminatedUnion("format", [
  z.object({ format: z.literal("truefalse"), value: z.boolean() }),
  z.object({ format: z.literal("estimate"), value: z.number().finite() }),
  z.object({ format: z.literal("compare"), itemId: z.string().max(64) }),
  z.object({ format: z.literal("rank"), order: z.array(z.string().max(64)).min(2).max(8) }),
  z.object({ format: z.literal("trend"), value: z.number().finite() }),
  z.object({ format: z.literal("map"), optionId: z.string().max(64) }),
]);
export type Answer = z.infer<typeof AnswerSchema>;

export interface ScoreResult {
  points: number;
  hit: boolean;
  /** Formatspesifikke detaljer brukt i avsløringen. */
  detail: Record<string, unknown>;
}

/** Glatt kurve: feil = toleranse gir 50 poeng, 2× toleranse gir 20, 3× gir 10. */
export function closenessPoints(error: number, tolerance: number): number {
  if (!Number.isFinite(error) || tolerance <= 0) return 0;
  const r = Math.abs(error) / tolerance;
  return Math.round(100 / (1 + r * r));
}

export function estimateError(guess: number, answer: number, scale: "linear" | "log"): number {
  if (scale === "log") {
    if (guess <= 0 || answer <= 0) return Number.POSITIVE_INFINITY;
    return Math.abs(Math.log(guess / answer));
  }
  return Math.abs(guess - answer);
}

/** Andel korrekt ordnede par (Kendall-konkordans) – gir delpoeng for nesten riktig rangering. */
export function pairConcordance(guess: string[], truth: string[]): number {
  const pos = new Map(guess.map((id, i) => [id, i]));
  let ok = 0;
  let total = 0;
  for (let i = 0; i < truth.length; i++) {
    for (let j = i + 1; j < truth.length; j++) {
      total++;
      const a = pos.get(truth[i]);
      const b = pos.get(truth[j]);
      if (a !== undefined && b !== undefined && a < b) ok++;
    }
  }
  return total === 0 ? 0 : ok / total;
}

export function correctRankOrder(payload: Extract<Payload, { format: "rank" }>): string[] {
  const items = [...payload.items].sort((a, b) => (payload.order === "desc" ? b.value - a.value : a.value - b.value));
  return items.map((i) => i.id);
}

export function correctCompareId(payload: Extract<Payload, { format: "compare" }>): string {
  const items = [...payload.items].sort((a, b) => (payload.pick === "highest" ? b.value - a.value : a.value - b.value));
  return items[0].id;
}

export class AnswerMismatchError extends Error {}

export function scoreAnswer(payload: Payload, answer: Answer): ScoreResult {
  if (payload.format !== answer.format) throw new AnswerMismatchError("Svaret passer ikke spørsmålsformatet");
  switch (payload.format) {
    case "truefalse": {
      const a = answer as Extract<Answer, { format: "truefalse" }>;
      const correct = a.value === payload.answer;
      return { points: correct ? 100 : 0, hit: correct, detail: { correct, answer: payload.answer } };
    }
    case "compare": {
      const a = answer as Extract<Answer, { format: "compare" }>;
      if (!payload.items.some((i) => i.id === a.itemId)) throw new AnswerMismatchError("Ukjent alternativ");
      const winner = correctCompareId(payload);
      const correct = a.itemId === winner;
      return { points: correct ? 100 : 0, hit: correct, detail: { correct, winner } };
    }
    case "rank": {
      const a = answer as Extract<Answer, { format: "rank" }>;
      const ids = new Set(payload.items.map((i) => i.id));
      if (a.order.length !== ids.size || !a.order.every((id) => ids.has(id)) || new Set(a.order).size !== ids.size) {
        throw new AnswerMismatchError("Rangeringen må inneholde alle alternativene nøyaktig én gang");
      }
      const truth = correctRankOrder(payload);
      const c = pairConcordance(a.order, truth);
      const points = Math.round(c * 100);
      const positionsCorrect = a.order.filter((id, i) => truth[i] === id).length;
      return { points, hit: points >= HIT_THRESHOLD, detail: { truth, concordance: c, positionsCorrect } };
    }
    case "estimate": {
      const a = answer as Extract<Answer, { format: "estimate" }>;
      const guess = clamp(a.value, payload.min, payload.max);
      const err = estimateError(guess, payload.answer, payload.scale);
      const points = closenessPoints(err, payload.tolerance);
      const relative = payload.answer !== 0 ? (guess - payload.answer) / Math.abs(payload.answer) : null;
      return {
        points,
        hit: points >= HIT_THRESHOLD,
        detail: { guess, answer: payload.answer, difference: guess - payload.answer, relative },
      };
    }
    case "trend": {
      const a = answer as Extract<Answer, { format: "trend" }>;
      const guess = clamp(a.value, payload.min, payload.max);
      const truth = payload.series[payload.series.length - 1].value;
      const lastKnown = payload.series[payload.known - 1].value;
      const points = closenessPoints(guess - truth, payload.tolerance);
      const dir = (v: number) => (Math.abs(v - lastKnown) < payload.tolerance * 0.25 ? 0 : Math.sign(v - lastKnown));
      return {
        points,
        hit: points >= HIT_THRESHOLD,
        detail: { guess, answer: truth, difference: guess - truth, directionCorrect: dir(guess) === dir(truth) },
      };
    }
    case "map": {
      const a = answer as Extract<Answer, { format: "map" }>;
      const opt = payload.options.find((o) => o.id === a.optionId);
      if (!opt) throw new AnswerMismatchError("Ukjent alternativ");
      const correctId = payload.options.find((o) => o.correct)!.id;
      return { points: opt.correct ? 100 : 0, hit: opt.correct, detail: { correct: opt.correct, correctId } };
    }
  }
}

function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v));
}

export interface RoundSummary {
  score: number;
  maxScore: number;
  hits: number;
  total: number;
  /** Gjennomsnittlig poeng på tallspørsmål (estimate/trend), eller null. */
  numericAccuracy: number | null;
}

export function summarize(results: { format: string; points: number; hit: boolean }[]): RoundSummary {
  const numeric = results.filter((r) => r.format === "estimate" || r.format === "trend");
  return {
    score: results.reduce((s, r) => s + r.points, 0),
    maxScore: results.length * 100,
    hits: results.filter((r) => r.hit).length,
    total: results.length,
    numericAccuracy: numeric.length ? Math.round(numeric.reduce((s, r) => s + r.points, 0) / numeric.length) : null,
  };
}
