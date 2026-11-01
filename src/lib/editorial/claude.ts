/**
 * KI-redaksjonen (Claude API). Får et ferdig beregnet funn og et deterministisk utkast,
 * og foreslår bedre formuleringer, kontekst, forbehold og interne prioriteringsanslag.
 *
 * Harde grenser:
 *  - Modellen får aldri lov til å endre tall, fasit, kilder eller referanseperiode – bare tekstfelt.
 *  - Svaret valideres med zod, og tall i teksten kontrolleres deterministisk etterpå (lib/qa).
 *  - Kostnad logges per kall, og kjøringen stopper når budsjettet er brukt opp.
 */
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";
import type { Finding } from "../data/analysis";
import type { Draft } from "./templates";

export const DEFAULT_MODEL = process.env.CLAUDE_MODEL ?? "claude-opus-5-5";

/** USD per million tokens (input, output). Oppdateres ved prisendringer. */
export const PRICES: Record<string, { input: number; output: number }> = {
  "claude-opus-5-5": { input: 4, output: 20 },
  "claude-sonnet-5-5": { input: 2, output: 10 },
  "claude-haiku-5-5": { input: 0.1, output: 0.5 },
  "claude-opus-4-8": { input: 5, output: 25 },
  "claude-fable-5-1": { input: 10, output: 50 },
};

export function costUsd(model: string, inputTokens: number, outputTokens: number): number {
  const p = PRICES[model] ?? PRICES["claude-opus-5-5"];
  return (inputTokens * p.input + outputTokens * p.output) / 1_000_000;
}

const Score = z.number().int().min(1).max(5);

export const EditorialSchema = z.object({
  include: z.boolean().describe("Er funnet verdt å bruke i spillet?"),
  kicker: z.string().describe("Kort, lekent stikkord, maks 40 tegn"),
  prompt: z.string().describe("Spørsmålet, maks 160 tegn, med referanseperiode"),
  headline: z.string().describe("Punchline etter avsløring, maks 120 tegn, én setning"),
  explanation: z.string().describe("1–3 korte setninger som setter funnet i kontekst"),
  deepDive: z.string().nullable().describe("«Hva sier tallene egentlig?» – metode og begrensninger, eller null"),
  caveats: z.array(z.string()).describe("0–3 metodeforbehold"),
  shareText: z.string().describe("Delingstekst uten fasit, maks 140 tegn"),
  tone: z.enum(["playful", "neutral", "serious"]),
  misconceptionAngle: z.string().nullable().describe("Hvilken mulig misforståelse belyses – aldri kalt en «myte» uten belegg"),
  visualizationHint: z.string().describe("Forslag til visuell avsløring"),
  scores: z.object({
    surprise: Score,
    recognizability: Score,
    socialRelevance: Score,
    humor: Score,
    competition: Score,
    enlightenment: Score,
    visual: Score,
    shareability: Score,
  }),
  needsManualReview: z.boolean(),
  reviewReasons: z.array(z.string()),
  suggestedRisk: z.enum(["low", "medium", "high"]),
});
export type Editorial = z.infer<typeof EditorialSchema>;

export const SYSTEM_PROMPT = `Du er redaktør i det norske kunnskapsspillet TULL ELLER TALL? («Du tror du vet. Men gjør du det?»).
Du får et statistisk funn som allerede er beregnet av kode, og et utkast til spørsmål. Din jobb er å gjøre spørsmålet morsomt, klart og redelig.

Absolutte regler:
- Bruk BARE tall som står i funnet. Ikke regn ut nye tall, ikke runde til nye tall, ikke legg til tall fra egen kunnskap.
- Ikke finn på kilder, årsaker eller konklusjoner. Ikke antyd årsakssammenheng ut fra samvariasjon.
- Ikke kall noe en «myte» eller «vanlig misforståelse» – vi har ikke data om hva folk tror.
- Ikke moraliser og ikke irettesett spilleren. Skriv nysgjerrig og inviterende, på norsk bokmål.
- Ikke fremstill grupper som ensartede, og ikke trekk slutninger om enkeltpersoner fra gruppestatistikk.
- Kriminalitet, migrasjon, etnisitet, religion, helse, diskriminering, død og årsakssammenhenger er høy risiko: nøktern tone, needsManualReview=true.
- Små tall og skjermede verdier krever forbehold.
- Referanseperioden må stå i spørsmålet.
- Delingsteksten skal vekke nysgjerrighet uten å avsløre svaret og uten lokketitler.
- Score 1–5 er interne anslag, ikke spådommer om viralitet.
Sett include=false hvis funnet er kjedelig, misvisende eller ikke egner seg som spill.`;

export interface EditorialResult {
  editorial: Editorial | null;
  model: string;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  error?: string;
}

export interface EditorialClient {
  enhance(finding: Finding, draft: Draft): Promise<EditorialResult>;
}

/** Ekte klient mot Claude API. Bruker server-side fallback ved avvisning fra sikkerhetsklassifisering. */
export function createClaudeEditor(opts: { model?: string; effort?: "low" | "medium" | "high" } = {}): EditorialClient {
  const client = new Anthropic();
  const model = opts.model ?? DEFAULT_MODEL;
  const effort = opts.effort ?? ((process.env.CLAUDE_EFFORT as "low" | "medium" | "high" | undefined) ?? "medium");
  return {
    async enhance(finding, draft) {
      const payload = {
        funn: {
          type: finding.kind,
          mål: finding.measure,
          periode: finding.period,
          fraPeriode: finding.fromPeriod ?? null,
          elementer: finding.items,
          tidsserie: finding.series ?? null,
          beregnet: finding.computed,
          forbehold: finding.guards,
          kilde: finding.provenance.sourceTitle,
        },
        utkast: {
          format: draft.question.payload.format,
          prompt: draft.question.prompt,
          headline: draft.question.reveal.headline,
          explanation: draft.question.reveal.explanation,
        },
      };
      try {
        const response = await client.beta.messages.parse({
          model,
          max_tokens: 16000,
          betas: ["server-side-fallback-2026-07-01"],
          fallbacks: "default",
          output_config: { effort, format: betaZodOutputFormat(EditorialSchema) },
          system: SYSTEM_PROMPT,
          messages: [{ role: "user", content: `Funn og utkast (JSON):\n${JSON.stringify(payload, null, 2)}` }],
        });
        const servedModel = response.model ?? model;
        const usage = response.usage;
        const cost = costUsd(servedModel, usage.input_tokens, usage.output_tokens);
        if (response.stop_reason === "refusal") {
          return { editorial: null, model: servedModel, inputTokens: usage.input_tokens, outputTokens: usage.output_tokens, costUsd: cost, error: "Avvist av modellen" };
        }
        const parsed = EditorialSchema.safeParse(response.parsed_output);
        return {
          editorial: parsed.success ? parsed.data : null,
          model: servedModel,
          inputTokens: usage.input_tokens,
          outputTokens: usage.output_tokens,
          costUsd: cost,
          error: parsed.success ? undefined : "Svaret fulgte ikke skjemaet",
        };
      } catch (err) {
        let msg = (err as Error).message;
        if (err instanceof Anthropic.RateLimitError) msg = "Rate limit hos Claude API";
        else if (err instanceof Anthropic.AuthenticationError) msg = "Ugyldig ANTHROPIC_API_KEY";
        else if (err instanceof Anthropic.APIError) msg = `Claude API-feil ${err.status}: ${err.message}`;
        return { editorial: null, model, inputTokens: 0, outputTokens: 0, costUsd: 0, error: msg };
      }
    },
  };
}

/** Bruk ferdig utkast uten KI (når nøkkel mangler eller budsjettet er brukt opp). */
export const templateOnlyEditor: EditorialClient = {
  async enhance() {
    return { editorial: null, model: "none", inputTokens: 0, outputTokens: 0, costUsd: 0 };
  },
};
