/**
 * Klientvisning av spørsmål: alt som avslører fasit fjernes før spørsmålet sendes til nettleseren.
 */
import type { Payload, QuestionContent } from "./schema";
import { correctRankOrder } from "./scoring";
import { seededRandom, shuffle } from "./prng";

export type PublicPayload =
  | { format: "truefalse"; statement: string }
  | {
      format: "estimate";
      unit: { suffix: string; prefix: string; decimals: number };
      min: number;
      max: number;
      scale: "linear" | "log";
      step: number;
      start: number;
      survey?: { question: string; population: string; fieldwork: string; n?: number };
    }
  | {
      format: "compare";
      indicator: string;
      unit: { suffix: string; prefix: string; decimals: number };
      pick: "highest" | "lowest";
      items: { id: string; label: string; sublabel?: string }[];
    }
  | {
      format: "rank";
      indicator: string;
      unit: { suffix: string; prefix: string; decimals: number };
      order: "desc" | "asc";
      items: { id: string; label: string; sublabel?: string }[];
    }
  | {
      format: "trend";
      indicator: string;
      unit: { suffix: string; prefix: string; decimals: number };
      periods: string[];
      known: { period: string; value: number }[];
      min: number;
      max: number;
      step: number;
    }
  | {
      format: "map";
      /** Klasse 0–4 (kvintiler) per fylke – ikke råverdier. */
      regions: { code: string; level: number }[];
      options: { id: string; label: string }[];
    };

export interface PublicQuestion {
  id: string;
  format: Payload["format"];
  category: QuestionContent["category"];
  topic: string;
  kicker?: string;
  tone: QuestionContent["tone"];
  prompt: string;
  payload: PublicPayload;
  shareText?: string;
}

export function neutralStart(p: Extract<Payload, { format: "estimate" }>): number {
  if (p.start !== undefined) return p.start;
  const mid = p.scale === "log" ? Math.sqrt(p.min * p.max) : (p.min + p.max) / 2;
  return Math.round(mid / p.step) * p.step;
}

export function quantileLevels(values: number[], classes = 5): number[] {
  const sorted = [...values].sort((a, b) => a - b);
  return values.map((v) => {
    const below = sorted.filter((s) => s < v).length;
    return Math.min(classes - 1, Math.floor((below / values.length) * classes));
  });
}

export function toPublic(q: QuestionContent, seed = q.id): PublicQuestion {
  const p = q.payload;
  const rand = seededRandom(`${seed}:${q.id}`);
  let payload: PublicPayload;
  switch (p.format) {
    case "truefalse":
      payload = { format: "truefalse", statement: p.statement };
      break;
    case "estimate":
      payload = {
        format: "estimate",
        unit: p.unit,
        min: p.min,
        max: p.max,
        scale: p.scale,
        step: p.step,
        start: neutralStart(p),
        survey: p.survey,
      };
      break;
    case "compare":
      payload = {
        format: "compare",
        indicator: p.indicator,
        unit: p.unit,
        pick: p.pick,
        items: shuffle(p.items, rand).map(({ id, label, sublabel }) => ({ id, label, sublabel })),
      };
      break;
    case "rank": {
      const truth = correctRankOrder(p);
      let items = shuffle(p.items, rand);
      // Unngå at startrekkefølgen er fasit (eller fasit baklengs).
      for (let i = 0; i < 6; i++) {
        const ids = items.map((x) => x.id).join();
        if (ids !== truth.join() && ids !== [...truth].reverse().join()) break;
        items = shuffle(p.items, rand);
      }
      payload = {
        format: "rank",
        indicator: p.indicator,
        unit: p.unit,
        order: p.order,
        items: items.map(({ id, label, sublabel }) => ({ id, label, sublabel })),
      };
      break;
    }
    case "trend":
      payload = {
        format: "trend",
        indicator: p.indicator,
        unit: p.unit,
        periods: p.series.map((s) => s.period),
        known: p.series.slice(0, p.known),
        min: p.min,
        max: p.max,
        step: p.step,
      };
      break;
    case "map": {
      const levels = quantileLevels(p.regions.map((r) => r.value));
      payload = {
        format: "map",
        regions: p.regions.map((r, i) => ({ code: r.code, level: levels[i] })),
        options: shuffle(p.options, rand).map(({ id, label }) => ({ id, label })),
      };
      break;
    }
  }
  return {
    id: q.id,
    format: p.format,
    category: q.category,
    topic: q.topic,
    kicker: q.kicker,
    tone: q.tone,
    prompt: q.prompt,
    payload,
    shareText: q.shareText,
  };
}

/** Full avsløring etter at svaret er levert. */
export interface RevealData {
  questionId: string;
  payload: Payload;
  reveal: QuestionContent["reveal"];
  sources: QuestionContent["sources"];
  referencePeriod: string;
  calculation?: string;
  lastVerified: string;
  verification: QuestionContent["verification"];
  risk: QuestionContent["risk"];
  tone: QuestionContent["tone"];
}

export function toReveal(q: QuestionContent): RevealData {
  return {
    questionId: q.id,
    payload: q.payload,
    reveal: q.reveal,
    sources: q.sources,
    referencePeriod: q.referencePeriod,
    calculation: q.calculation,
    lastVerified: q.lastVerified,
    verification: q.verification,
    risk: q.risk,
    tone: q.tone,
  };
}
