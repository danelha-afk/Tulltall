import { describe, expect, it } from "vitest";
import { categoryTargets, composeDailyGame, DEFAULT_ROTATION, type PoolQuestion } from "@/lib/game/rotation";
import { FORMATS } from "@/lib/game/schema";
import { addDays } from "@/lib/game/dates";

function pool(n: number): PoolQuestion[] {
  const cats = ["fun", "fun", "fun", "fun", "fun", "fun", "misconception", "misconception", "misconception", "current"] as const;
  return Array.from({ length: n }, (_, i) => ({
    id: `q${i}`,
    category: cats[i % cats.length],
    topic: `t${i % 9}`,
    format: FORMATS[i % FORMATS.length],
    difficulty: (i % 5) + 1,
    risk: i % 17 === 0 ? "high" : "low",
    tone: i % 17 === 0 ? "serious" : "playful",
    dataQuality: 4,
    exposureCount: 0,
    lastUsedOn: null,
    seasonMonths: [],
    lastVerified: "2026-10-01",
  }));
}

describe("rotasjon", () => {
  it("fordeler innholdsmiksen 60/30/10", () => {
    expect(categoryTargets(10, { fun: 0.6, misconception: 0.3, current: 0.1 })).toEqual({ fun: 6, misconception: 3, current: 1 });
    expect(categoryTargets(7, { fun: 0.6, misconception: 0.3, current: 0.1 })).toEqual({ fun: 4, misconception: 2, current: 1 });
  });

  it("er deterministisk for samme dato og pool", () => {
    const p = pool(80);
    const a = composeDailyGame(p, "2026-11-01");
    const b = composeDailyGame(p, "2026-11-01");
    const c = composeDailyGame(p, "2026-11-02");
    expect(a.questionIds).toEqual(b.questionIds);
    expect(a.questionIds).not.toEqual(c.questionIds);
  });

  it("respekterer miks, emne-, format- og risikogrenser", () => {
    const r = composeDailyGame(pool(120), "2026-11-03");
    const p = new Map(pool(120).map((q) => [q.id, q]));
    const qs = r.questionIds.map((id) => p.get(id)!);
    expect(qs).toHaveLength(10);
    expect(new Set(r.questionIds).size).toBe(10);
    expect(qs.filter((q) => q.category === "fun")).toHaveLength(6);
    expect(qs.filter((q) => q.category === "misconception")).toHaveLength(3);
    expect(qs.filter((q) => q.risk === "high").length).toBeLessThanOrEqual(1);
    const topics = new Map<string, number>();
    qs.forEach((q) => topics.set(q.topic, (topics.get(q.topic) ?? 0) + 1));
    expect(Math.max(...topics.values())).toBeLessThanOrEqual(DEFAULT_ROTATION.maxPerTopic);
    expect(qs[0].tone).not.toBe("serious");
    expect(qs[qs.length - 1].risk).not.toBe("high");
  });

  it("unngår gjentakelser innen karantenetiden når banken er stor nok", () => {
    let p = pool(150);
    const seen = new Map<string, string>();
    for (let d = 0; d < 10; d++) {
      const date = addDays("2026-11-01", d);
      const r = composeDailyGame(p, date);
      for (const id of r.questionIds) {
        expect(seen.has(id), `${id} gjentatt ${date}`).toBe(false);
        seen.set(id, date);
      }
      p = p.map((q) => (r.questionIds.includes(q.id) ? { ...q, exposureCount: q.exposureCount + 1, lastUsedOn: date } : q));
    }
  });

  it("lemper karantene når banken er liten, men gir likevel en full runde", () => {
    const p = pool(12).map((q) => ({ ...q, lastUsedOn: "2026-10-30", exposureCount: 1 }));
    const r = composeDailyGame(p, "2026-11-01");
    expect(r.questionIds).toHaveLength(10);
    expect(r.diagnostics.relaxations.join(" ")).toMatch(/karantene/);
  });

  it("utelater utdaterte spørsmål", () => {
    const p = pool(30).map((q, i) => (i < 5 ? { ...q, lastVerified: "2023-01-01" } : q));
    const r = composeDailyGame(p, "2026-11-01");
    expect(r.questionIds.some((id) => ["q0", "q1", "q2", "q3", "q4"].includes(id))).toBe(false);
  });

  it("tar med høyst ett spørsmål om likestilling/mangfold per runde, uansett hvor mange det er i banken", () => {
    // Halvparten av banken handler om likestilling/mangfold.
    const p = pool(120).map((q, i) => ({ ...q, equality: i % 2 === 0 }));
    for (let d = 0; d < 30; d++) {
      const date = addDays("2026-11-01", d);
      const r = composeDailyGame(p, date);
      const byId = new Map(p.map((q) => [q.id, q]));
      const n = r.questionIds.filter((id) => byId.get(id)!.equality).length;
      expect(n, date).toBeLessThanOrEqual(1);
      expect(r.questionIds).toHaveLength(10);
    }
  });
});
