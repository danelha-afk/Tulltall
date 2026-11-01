import { describe, expect, it } from "vitest";
import { closenessPoints, pairConcordance, scoreAnswer, summarize, AnswerMismatchError } from "@/lib/game/scoring";
import type { Payload } from "@/lib/game/schema";

const est: Payload = { format: "estimate", unit: { suffix: "%", prefix: "", decimals: 1 }, answer: 40, min: 0, max: 100, scale: "linear", step: 1, tolerance: 5 };

describe("poengberegning", () => {
  it("gir full pott ved eksakt svar og halvparten ved én toleranse unna", () => {
    expect(closenessPoints(0, 5)).toBe(100);
    expect(closenessPoints(5, 5)).toBe(50);
    expect(closenessPoints(10, 5)).toBe(20);
    expect(closenessPoints(15, 5)).toBe(10);
  });

  it("belønner gode anslag på tallspørsmål", () => {
    expect(scoreAnswer(est, { format: "estimate", value: 40 }).points).toBe(100);
    expect(scoreAnswer(est, { format: "estimate", value: 42 }).hit).toBe(true);
    expect(scoreAnswer(est, { format: "estimate", value: 60 }).hit).toBe(false);
  });

  it("klemmer gjetninger utenfor skalaen", () => {
    const r = scoreAnswer(est, { format: "estimate", value: 1e9 });
    expect(r.detail.guess).toBe(100);
  });

  it("bruker relativ feil på logaritmisk skala", () => {
    const log: Payload = { format: "estimate", unit: { suffix: "", prefix: "", decimals: 0 }, answer: 1000, min: 1, max: 1e6, scale: "log", step: 1, tolerance: Math.log(1.25) };
    expect(scoreAnswer(log, { format: "estimate", value: 1250 }).points).toBe(50);
    expect(scoreAnswer(log, { format: "estimate", value: 800 }).points).toBe(50);
  });

  it("gir delpoeng for nesten riktig rangering", () => {
    expect(pairConcordance(["a", "b", "c", "d"], ["a", "b", "c", "d"])).toBe(1);
    expect(pairConcordance(["b", "a", "c", "d"], ["a", "b", "c", "d"])).toBeCloseTo(5 / 6);
    expect(pairConcordance(["d", "c", "b", "a"], ["a", "b", "c", "d"])).toBe(0);
    const rank: Payload = {
      format: "rank",
      indicator: "x",
      unit: { suffix: "", prefix: "", decimals: 0 },
      order: "desc",
      items: [
        { id: "a", label: "A", value: 4 },
        { id: "b", label: "B", value: 3 },
        { id: "c", label: "C", value: 2 },
        { id: "d", label: "D", value: 1 },
      ],
    };
    expect(scoreAnswer(rank, { format: "rank", order: ["b", "a", "c", "d"] }).points).toBe(83);
    expect(() => scoreAnswer(rank, { format: "rank", order: ["a", "a", "c", "d"] })).toThrow(AnswerMismatchError);
  });

  it("avviser svar i feil format", () => {
    expect(() => scoreAnswer(est, { format: "truefalse", value: true })).toThrow(AnswerMismatchError);
  });

  it("oppsummerer runden og tallsans", () => {
    const s = summarize([
      { format: "estimate", points: 80, hit: true },
      { format: "truefalse", points: 0, hit: false },
      { format: "trend", points: 40, hit: false },
    ]);
    expect(s).toEqual({ score: 120, maxScore: 300, hits: 1, total: 3, numericAccuracy: 60 });
  });
});
