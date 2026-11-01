import { describe, expect, it } from "vitest";
import enkle from "../content/questions/enkle.json";
import { seedReviewOnlyIds } from "../content/questions/index";
import { parseQuestion } from "@/lib/game/schema";
import { validateQuestion } from "@/lib/qa/validate";

describe("enkle spørsmål om sensitive temaer", () => {
  it("er gyldige, korte og starter alltid i godkjenningskøen", () => {
    expect(enkle.length).toBeGreaterThanOrEqual(15);
    for (const raw of enkle) {
      const parsed = parseQuestion(raw);
      expect(parsed.ok, raw.id).toBe(true);
      if (!parsed.ok) continue;
      const q = parsed.value;
      const qa = validateQuestion(q, { today: q.lastVerified });
      expect(qa.errors, q.id).toEqual([]);
      if (q.payload.format === "truefalse") {
        // Skriv enkelt: én kort påstand (maks 12 ord).
        expect(q.payload.statement.split(/\s+/).length, q.id).toBeLessThanOrEqual(12);
      }
      expect(q.reveal.explanation.split(/[.!?]+\s/).length, q.id).toBeLessThanOrEqual(3);
      expect(q.verification.method, q.id).toBe("secondary-snippet");
      expect(seedReviewOnlyIds.has(q.id), q.id).toBe(true);
    }
  });

  it("har både «stemmer» og «stemmer ikke» som fasit", () => {
    const answers = enkle.map((q) => (q.payload as { answer: boolean }).answer);
    expect(answers).toContain(true);
    expect(answers).toContain(false);
  });
});
