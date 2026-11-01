import { describe, expect, it } from "vitest";
import { isEqualityTheme } from "@/lib/game/themes";
import { seedQuestions } from "../content/questions/index";
import { parseQuestion } from "@/lib/game/schema";
import { composeDailyGame, type PoolQuestion } from "@/lib/game/rotation";
import { addDays } from "@/lib/game/dates";

describe("tema: likestilling/mangfold", () => {
  it("gjenkjenner emne, tagg og nøkkelord", () => {
    expect(isEqualityTheme({ topic: "likestilling", tags: [] })).toBe(true);
    expect(isEqualityTheme({ topic: "arbeid", tags: ["likestilling-mangfold"] })).toBe(true);
    expect(isEqualityTheme({ topic: "dyr", tags: ["jakt", "kjønn"] })).toBe(true);
    expect(isEqualityTheme({ topic: "dyr", tags: ["jakt"] })).toBe(false);
  });

  it("den ekte banken gir aldri mer enn ett likestillings-/mangfoldsspørsmål per dag", () => {
    const pool: PoolQuestion[] = [];
    for (const raw of seedQuestions) {
      const parsed = parseQuestion(raw);
      if (!parsed.ok) continue;
      const q = parsed.value;
      pool.push({
        id: q.id,
        category: q.category,
        topic: q.topic,
        format: q.payload.format,
        difficulty: q.difficulty,
        risk: q.risk,
        tone: q.tone,
        dataQuality: q.dataQuality,
        exposureCount: 0,
        lastUsedOn: null,
        seasonMonths: [],
        lastVerified: q.lastVerified,
        equality: isEqualityTheme({ topic: q.topic, tags: q.tags }),
      });
    }
    expect(pool.filter((q) => q.equality).length).toBeGreaterThan(40);
    const byId = new Map(pool.map((q) => [q.id, q]));
    for (let d = 0; d < 40; d++) {
      const date = addDays("2026-11-02", d);
      const r = composeDailyGame(pool, date);
      expect(r.questionIds.filter((id) => byId.get(id)!.equality).length, date).toBeLessThanOrEqual(1);
    }
  });
});
