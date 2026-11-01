import { describe, expect, it } from "vitest";
import { validateQuestion, numbersInText, similarity, computeRisk } from "@/lib/qa/validate";
import { parseQuestion, type QuestionContent } from "@/lib/game/schema";
import { seedQuestions } from "@content/questions/index";

const base = {
  id: "test-sporsmal",
  category: "fun",
  topic: "test",
  tags: [],
  difficulty: 2,
  risk: "low",
  tone: "playful",
  prompt: "Hvor mange hytter finnes det i Norge i 2025?",
  payload: { format: "estimate", unit: { suffix: "hytter", prefix: "", decimals: 0 }, answer: 483631, min: 1000, max: 3000000, scale: "log", step: 1000, tolerance: 0.3 },
  reveal: { headline: "Nesten en halv million.", explanation: "Det var 483 631 fritidsbygg i 2025.", caveats: [] },
  sources: [{ publisher: "SSB", title: "Fritidsbygg", url: "https://www.ssb.no/fritidsbyggomr", accessed: "2026-11-01" }],
  referencePeriod: "2025",
  lastVerified: "2026-11-01",
};

function q(over: Record<string, unknown> = {}): QuestionContent {
  const r = parseQuestion({ ...base, ...over });
  if (!r.ok) throw new Error(r.errors.join("; "));
  return r.value;
}

describe("faktakontroll", () => {
  it("godtar et korrekt spørsmål", () => {
    const res = validateQuestion(q(), { today: "2026-11-01" });
    expect(res.ok).toBe(true);
  });

  it("finner tall i norsk tekst", () => {
    expect(numbersInText("Det var 483 631 hytter og 12,5 % i 2025.")).toEqual([483631, 12.5, 2025]);
  });

  it("avviser tall i KI-tekst som ikke finnes i datagrunnlaget (streng modus)", () => {
    const res = validateQuestion(q({ reveal: { ...base.reveal, explanation: "Det var 512 000 fritidsbygg i 2025." } }), { today: "2026-11-01", strictNumbers: true });
    expect(res.ok).toBe(false);
    expect(res.errors.join()).toMatch(/512000/);
  });

  it("krever minst riktig risikonivå for sensitive temaer", () => {
    const res = validateQuestion(q({ prompt: "Hvor mange lovbrudd ble anmeldt i 2025?" }), { today: "2026-11-01" });
    expect(res.ok).toBe(false);
    expect(res.computedRisk).toBe("high");
  });

  it("flagger årsaksspråk og avviser moraliserende tekst og udokumenterte «myter»", () => {
    const causal = validateQuestion(q({ reveal: { ...base.reveal, explanation: "Det var 483 631 fritidsbygg fordi folk er rike." } }), { today: "2026-11-01" });
    expect(causal.flags.join()).toMatch(/årsak/);
    const moral = validateQuestion(q({ reveal: { ...base.reveal, explanation: "Du tok feil fordi du har fordommer." } }), { today: "2026-11-01" });
    expect(moral.ok).toBe(false);
    const myth = validateQuestion(q({ reveal: { ...base.reveal, headline: "En vanlig myte avkreftet." } }), { today: "2026-11-01" });
    expect(myth.ok).toBe(false);
  });

  it("oppdager utdaterte og nesten like spørsmål", () => {
    expect(validateQuestion(q(), { today: "2028-11-01" }).ok).toBe(false);
    const dup = validateQuestion(q({ id: "kopi-1" }), { today: "2026-11-01", existing: [{ id: "orig", prompt: base.prompt }] });
    expect(dup.duplicateOf).toBe("orig");
    expect(similarity("Hvor mange hytter finnes i Norge?", "Hvor mange elbiler finnes i Sverige?")).toBeLessThan(0.72);
  });

  it("avviser prosentandeler utenfor 0–100 og fasit lik startverdi", () => {
    expect(parseQuestion({ ...base, payload: { ...base.payload, unit: { suffix: "%", prefix: "", decimals: 0 }, answer: 140, min: 0, max: 200, scale: "linear", step: 1, tolerance: 5 } }).ok).toBe(false);
    const res = validateQuestion(q({ payload: { ...base.payload, scale: "linear", min: 0, max: 967262, start: 483631 } }), { today: "2026-11-01" });
    expect(res.errors.join()).toMatch(/startverdi/);
  });

  it("klassifiserer risiko", () => {
    expect(computeRisk(q())).toBe("low");
    expect(computeRisk(q({ category: "misconception" }))).toBe("medium");
  });
});

describe("seed-banken", () => {
  it("alle seed-spørsmål er gyldige og består faktakontrollen", () => {
    const existing: { id: string; prompt: string }[] = [];
    const ids = new Set<string>();
    for (const raw of seedQuestions) {
      const p = parseQuestion(raw);
      expect(p.ok, JSON.stringify(p)).toBe(true);
      if (!p.ok) continue;
      expect(ids.has(p.value.id)).toBe(false);
      ids.add(p.value.id);
      const r = validateQuestion(p.value, { existing, today: p.value.lastVerified });
      expect(r.errors, p.value.id).toEqual([]);
      existing.push({ id: p.value.id, prompt: p.value.prompt });
      if (p.value.risk === "high") expect(p.value.reveal.deepDive, p.value.id).toBeTruthy();
    }
    expect(ids.size).toBeGreaterThanOrEqual(60);
  });
});
