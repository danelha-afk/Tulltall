import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { estimateOptions, granularity } from "@/lib/game/options";
import { seededRandom } from "@/lib/game/prng";
import { toPublic } from "@/lib/game/public";
import type { Payload } from "@/lib/game/schema";

type Est = Extract<Payload, { format: "estimate" }>;

function bank(): { id: string; payload: Est }[] {
  const dir = path.join(process.cwd(), "content/questions");
  const out: { id: string; payload: Est }[] = [];
  for (const f of ["current.json", "fun.json", "society.json"]) {
    const raw = JSON.parse(fs.readFileSync(path.join(dir, f), "utf8"));
    for (const q of Array.isArray(raw) ? raw : raw.questions) {
      if (q.payload?.format === "estimate") out.push({ id: q.id, payload: q.payload });
    }
  }
  return out;
}

describe("svaralternativer til tallspørsmål", () => {
  it("avrunder like grovt som fasit", () => {
    expect(granularity(25_000_000)).toBe(1_000_000);
    expect(granularity(5_627_400)).toBe(100);
    expect(granularity(483_631)).toBe(1);
    expect(granularity(3.1)).toBeCloseTo(0.1);
    expect(granularity(3.78)).toBeCloseTo(0.01);
    expect(granularity(220)).toBe(10);
  });

  it("alle spørsmål i banken får fire stigende alternativer innenfor skalaen, med fasit blant dem", () => {
    const questions = bank();
    expect(questions.length).toBeGreaterThan(20);
    for (const { id, payload } of questions) {
      for (let s = 0; s < 40; s++) {
        const opts = estimateOptions(payload, seededRandom(`seed${s}:${id}`));
        expect(opts, id).toHaveLength(4);
        expect(opts, id).toContain(payload.answer);
        expect(new Set(opts).size, id).toBe(4);
        expect([...opts].sort((a, b) => a - b), id).toEqual(opts);
        for (const o of opts) {
          expect(o, id).toBeGreaterThanOrEqual(payload.min);
          expect(o, id).toBeLessThanOrEqual(payload.max);
        }
      }
    }
  });

  it("fasit havner på alle plasser, ikke alltid samme (ingen mønster som avslører den)", () => {
    for (const { id, payload } of bank()) {
      const count = [0, 0, 0, 0];
      const N = 400;
      for (let s = 0; s < N; s++) {
        const opts = estimateOptions(payload, seededRandom(`x${s}:${id}`));
        count[opts.indexOf(payload.answer)]++;
      }
      // Kantnære spørsmål (f.eks. 0–15 %) rommer ikke alle plasser, men minst tre skal forekomme, og ingen skal dominere.
      expect(count.filter((c) => c / N > 0.1).length, `${id} ${count}`).toBeGreaterThanOrEqual(3);
      for (const c of count) expect(c / N, `${id} ${count}`).toBeLessThan(0.5);

    }
  });

  it("er deterministisk for samme frø og lekker ikke fasit i den offentlige varianten utover alternativene", () => {
    const { id, payload } = bank()[0];
    const q = {
      id,
      format: "estimate",
      category: "fun",
      topic: "t",
      tone: "playful",
      prompt: "Hvor mye?",
      payload,
    } as never;
    const a = toPublic(q, "s1");
    const b = toPublic(q, "s1");
    expect(a).toEqual(b);
    expect(JSON.stringify(a)).not.toContain('"answer"');
    expect(a.payload.format === "estimate" && a.payload.options.length).toBe(4);
  });
});
