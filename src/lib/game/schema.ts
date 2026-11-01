/**
 * Kanonisk skjema for spørsmål. Alt innhold – manuelt, seed eller generert av datamotoren –
 * valideres mot dette før det kan lagres. KI-redaksjonen leverer bare tekstfelt; tallene
 * kommer fra datamotoren og kontrolleres deterministisk (se lib/qa).
 */
import { z } from "zod";

export const FORMATS = ["truefalse", "estimate", "compare", "rank", "trend", "map"] as const;
export type Format = (typeof FORMATS)[number];

export const CATEGORIES = ["fun", "misconception", "current"] as const;
export type Category = (typeof CATEGORIES)[number];

export const RISKS = ["low", "medium", "high"] as const;
export type Risk = (typeof RISKS)[number];

export const STATUSES = ["draft", "validated", "review_required", "approved", "published", "archived"] as const;
export type QuestionStatus = (typeof STATUSES)[number];

export const TONES = ["playful", "neutral", "serious"] as const;
export type Tone = (typeof TONES)[number];

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Dato må være YYYY-MM-DD");

export const SourceSchema = z.object({
  publisher: z.string().min(2),
  title: z.string().min(3),
  url: z.string().url().refine((u) => u.startsWith("https://"), "Kilde-URL må bruke https"),
  tableId: z.string().optional(),
  accessed: isoDate,
  note: z.string().optional(),
});
export type Source = z.infer<typeof SourceSchema>;

const UnitSchema = z.object({
  /** Vises etter tallet, f.eks. "%", "kr", "hytter". */
  suffix: z.string().default(""),
  prefix: z.string().default(""),
  decimals: z.number().int().min(0).max(3).default(0),
});

export const TrueFalsePayload = z.object({
  format: z.literal("truefalse"),
  statement: z.string().min(10).max(240),
  answer: z.boolean(),
  /** Sann versjon av påstanden – vises ved avsløring når påstanden var tull. */
  correction: z.string().max(240).optional(),
});

export const EstimatePayload = z.object({
  format: z.literal("estimate"),
  unit: UnitSchema,
  answer: z.number(),
  min: z.number(),
  max: z.number(),
  scale: z.enum(["linear", "log"]).default("linear"),
  step: z.number().positive(),
  /** Feil (i enheter for lineær skala, relativ for log) som gir 50 poeng. */
  tolerance: z.number().positive(),
  /** Startposisjon for kontrollen – nøytral, ikke et hint. */
  start: z.number().optional(),
  /** «Hva tror du folk tror?» – svaret er et resultat fra en representativ undersøkelse. */
  survey: z
    .object({ question: z.string(), population: z.string(), fieldwork: z.string(), n: z.number().int().positive().optional() })
    .optional(),
});

const ItemSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1).max(60),
  sublabel: z.string().max(80).optional(),
  value: z.number(),
});

export const ComparePayload = z.object({
  format: z.literal("compare"),
  indicator: z.string().min(3),
  unit: UnitSchema,
  /** Hvem er størst eller minst? */
  pick: z.enum(["highest", "lowest"]).default("highest"),
  items: z.array(ItemSchema).min(2).max(4),
});

export const RankPayload = z.object({
  format: z.literal("rank"),
  indicator: z.string().min(3),
  unit: UnitSchema,
  order: z.enum(["desc", "asc"]).default("desc"),
  items: z.array(ItemSchema).min(3).max(6),
});

export const TrendPayload = z.object({
  format: z.literal("trend"),
  indicator: z.string().min(3),
  unit: UnitSchema,
  /** Hele serien. De `known` første punktene vises; spilleren gjetter siste verdi. */
  series: z.array(z.object({ period: z.string(), value: z.number() })).min(3).max(40),
  known: z.number().int().min(1),
  min: z.number(),
  max: z.number(),
  step: z.number().positive(),
  tolerance: z.number().positive(),
});

export const MapPayload = z.object({
  format: z.literal("map"),
  unit: UnitSchema,
  /** Verdier per fylke (fylkesnummer). Kartet viser mønsteret uten å si hva det er. */
  regions: z.array(z.object({ code: z.string(), value: z.number() })).min(5),
  options: z
    .array(z.object({ id: z.string(), label: z.string().min(2).max(70), correct: z.boolean() }))
    .min(2)
    .max(4),
  indicator: z.string().min(3),
});

export const PayloadSchema = z.discriminatedUnion("format", [
  TrueFalsePayload,
  EstimatePayload,
  ComparePayload,
  RankPayload,
  TrendPayload,
  MapPayload,
]);
export type Payload = z.infer<typeof PayloadSchema>;

export const RevealSchema = z.object({
  /** Kort punchline etter svaret (maks én setning). */
  headline: z.string().min(3).max(140),
  /** 1–3 setninger som setter funnet i kontekst. */
  explanation: z.string().min(10).max(600),
  /** «Hva sier tallene egentlig?» – metode, begrensninger og alternative tolkninger. */
  deepDive: z.string().max(1600).optional(),
  caveats: z.array(z.string().max(300)).default([]),
});

export const BindingSchema = z
  .object({
    source: z.literal("ssb"),
    tableId: z.string(),
    /** Utvalg: dimensjonskode → verdikoder. */
    selection: z.record(z.string(), z.array(z.string())),
    /** Hvilken payload-verdi uttrekket skal kontrollere. */
    target: z.string(),
    transform: z.enum(["value", "sum", "share"]).default("value"),
    toleranceRel: z.number().nonnegative().default(0.005),
  })
  .describe("Kobling til primærdata for automatisk etterkontroll");

export const QuestionContentSchema = z.object({
  id: z.string().regex(/^[a-z0-9][a-z0-9-]{2,80}$/),
  locale: z.literal("nb").default("nb"),
  category: z.enum(CATEGORIES),
  topic: z.string().min(2).max(40),
  tags: z.array(z.string()).default([]),
  difficulty: z.number().int().min(1).max(5),
  risk: z.enum(RISKS),
  tone: z.enum(TONES).default("playful"),
  kicker: z.string().max(40).optional(),
  prompt: z.string().min(8).max(200),
  payload: PayloadSchema,
  reveal: RevealSchema,
  sources: z.array(SourceSchema).min(1),
  referencePeriod: z.string().min(4),
  /** Dokumentert beregning når svaret er utledet. */
  calculation: z.string().max(800).optional(),
  lastVerified: isoDate,
  /** Hvordan siste kontroll ble gjort (ærlig sporbarhet). */
  verification: z
    .object({
      method: z.enum(["primary-table", "primary-publication", "secondary-snippet", "derived", "pipeline"]),
      note: z.string().max(400).optional(),
    })
    .default({ method: "primary-publication" }),
  /** Delingstekst for enkeltspørsmål – aldri svaret. */
  shareText: z.string().max(160).optional(),
  /** Måneder (1–12) der spørsmålet er særlig aktuelt. */
  seasonMonths: z.array(z.number().int().min(1).max(12)).default([]),
  dataQuality: z.number().int().min(1).max(5).default(3),
  binding: BindingSchema.optional(),
});
export type QuestionContent = z.infer<typeof QuestionContentSchema>;
export type QuestionContentInput = z.input<typeof QuestionContentSchema>;

/** Interne prioriteringsanslag (1–5). Ikke prediksjoner – se docs/redaksjon.md. */
export const SCORE_DIMENSIONS = [
  "surprise",
  "recognizability",
  "socialRelevance",
  "humor",
  "competition",
  "enlightenment",
  "dataQuality",
  "visual",
  "shareability",
] as const;
export type ScoreDimension = (typeof SCORE_DIMENSIONS)[number];
export const ScoresSchema = z.object(
  Object.fromEntries(SCORE_DIMENSIONS.map((d) => [d, z.number().min(1).max(5)])) as Record<
    ScoreDimension,
    z.ZodNumber
  >,
);
export type Scores = z.infer<typeof ScoresSchema>;

/** Semantiske regler som zod ikke uttrykker alene. Returnerer liste med feil (tom = OK). */
export function semanticErrors(q: QuestionContent): string[] {
  const errs: string[] = [];
  const p = q.payload;
  switch (p.format) {
    case "estimate": {
      if (!(p.min < p.max)) errs.push("estimate: min må være mindre enn max");
      if (p.answer < p.min || p.answer > p.max) errs.push("estimate: fasit ligger utenfor skalaen");
      if (p.scale === "log" && p.min <= 0) errs.push("estimate: log-skala krever min > 0");
      if (p.start !== undefined && (p.start < p.min || p.start > p.max)) errs.push("estimate: start utenfor skala");
      break;
    }
    case "compare": {
      const vals = p.items.map((i) => i.value);
      const best = p.pick === "highest" ? Math.max(...vals) : Math.min(...vals);
      if (vals.filter((v) => v === best).length > 1) errs.push("compare: uavgjort – fasit er ikke entydig");
      const sorted = [...vals].sort((a, b) => b - a);
      const gap = Math.abs(sorted[0] - sorted[1]) / Math.max(Math.abs(sorted[0]), 1e-9);
      if (p.pick === "highest" && gap < 0.01) errs.push("compare: for liten forskjell mellom de to største (<1 %)");
      if (new Set(p.items.map((i) => i.label)).size !== p.items.length) errs.push("compare: like etiketter");
      if (new Set(p.items.map((i) => i.id)).size !== p.items.length) errs.push("compare: like id-er");
      break;
    }
    case "rank": {
      const vals = p.items.map((i) => i.value);
      if (new Set(vals).size !== vals.length) errs.push("rank: like verdier gir ikke entydig rekkefølge");
      if (new Set(p.items.map((i) => i.id)).size !== p.items.length) errs.push("rank: like id-er");
      break;
    }
    case "trend": {
      if (p.known >= p.series.length) errs.push("trend: known må være mindre enn antall punkter");
      const last = p.series[p.series.length - 1].value;
      if (last < p.min || last > p.max) errs.push("trend: fasit utenfor skalaen");
      break;
    }
    case "map": {
      if (p.options.filter((o) => o.correct).length !== 1) errs.push("map: nøyaktig ett riktig alternativ");
      break;
    }
    case "truefalse": {
      if (!p.answer && !p.correction) errs.push("truefalse: tull-påstander trenger en korrigering");
      break;
    }
  }
  if (q.payload.format !== "truefalse" && "unit" in q.payload) {
    const u = q.payload.unit;
    if (u.suffix === "%" && "answer" in q.payload && (q.payload.answer < 0 || q.payload.answer > 100)) {
      errs.push("prosentandel utenfor 0–100");
    }
  }
  if (q.risk === "high" && !q.reveal.deepDive) errs.push("høyrisiko-spørsmål må ha «Hva sier tallene egentlig?»");
  if (q.risk === "high" && q.tone === "playful") errs.push("høyrisiko-spørsmål kan ikke ha leken tone");
  return errs;
}

export function parseQuestion(input: unknown): { ok: true; value: QuestionContent } | { ok: false; errors: string[] } {
  const res = QuestionContentSchema.safeParse(input);
  if (!res.success) {
    return { ok: false, errors: res.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`) };
  }
  const sem = semanticErrors(res.data);
  if (sem.length) return { ok: false, errors: sem };
  return { ok: true, value: res.data };
}
