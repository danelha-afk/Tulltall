/**
 * Driftsinnstillinger som eieren kan endre i administrasjonen uten kodeendring.
 */
import { z } from "zod";
import type { Db } from "./client";
import { DEFAULT_ROTATION } from "../game/rotation";

export const ExperimentSchema = z.object({
  key: z.string().regex(/^[a-z0-9_]{2,40}$/),
  description: z.string().max(200),
  variants: z.array(z.string().regex(/^[a-z0-9_]{1,20}$/)).min(2).max(4),
  /** Andel (0–1) per variant; summerer til 1. */
  weights: z.array(z.number().min(0).max(1)),
  active: z.boolean(),
});
export type Experiment = z.infer<typeof ExperimentSchema>;

export const SettingsSchema = z.object({
  contentMix: z.object({ fun: z.number().min(0).max(1), misconception: z.number().min(0).max(1), current: z.number().min(0).max(1) }),
  roundSize: z.number().int().min(3).max(15),
  cooldownDays: z.number().int().min(0).max(365),
  maxPerTopic: z.number().int().min(1).max(10),
  maxPerFormat: z.number().int().min(1).max(10),
  staleDays: z.number().int().min(30).max(2000),
  /** Fullautomatisk publisering av lavrisiko-spørsmål fra godkjente maler. Av som standard. */
  autoPublishLowRisk: z.boolean(),
  adsEnabled: z.boolean(),
  aiMonthlyBudgetUsd: z.number().min(0).max(10_000),
  aiRunBudgetUsd: z.number().min(0).max(1000),
  aiMaxCandidatesPerRun: z.number().int().min(0).max(500),
  nabokrigMinPlayers: z.number().int().min(1).max(100),
  experiments: z.array(ExperimentSchema),
});
export type Settings = z.infer<typeof SettingsSchema>;

export const DEFAULT_SETTINGS: Settings = {
  contentMix: DEFAULT_ROTATION.mix,
  roundSize: DEFAULT_ROTATION.size,
  cooldownDays: DEFAULT_ROTATION.cooldownDays,
  maxPerTopic: DEFAULT_ROTATION.maxPerTopic,
  maxPerFormat: DEFAULT_ROTATION.maxPerFormat,
  staleDays: DEFAULT_ROTATION.staleDays,
  autoPublishLowRisk: false,
  adsEnabled: false,
  aiMonthlyBudgetUsd: 25,
  aiRunBudgetUsd: 4,
  aiMaxCandidatesPerRun: 40,
  nabokrigMinPlayers: 5,
  experiments: [
    {
      key: "result_layout",
      description: "Resultatvisning: billett med hullmønster (a) eller billett med stor poengsum først (b)",
      variants: ["a", "b"],
      weights: [0.5, 0.5],
      active: false,
    },
  ],
};

export async function getSettings(db: Db): Promise<Settings> {
  const row = await db.one<{ value: unknown }>(`SELECT value FROM settings WHERE key = 'app'`);
  if (!row) return DEFAULT_SETTINGS;
  const merged = { ...DEFAULT_SETTINGS, ...(row.value as object) };
  const parsed = SettingsSchema.safeParse(merged);
  return parsed.success ? parsed.data : DEFAULT_SETTINGS;
}

export async function saveSettings(db: Db, patch: Partial<Settings>): Promise<Settings> {
  const next = SettingsSchema.parse({ ...(await getSettings(db)), ...patch });
  await db.query(
    `INSERT INTO settings (key, value, updated_at) VALUES ('app', $1::jsonb, now())
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()`,
    [JSON.stringify(next)],
  );
  return next;
}

export function rotationConfigFrom(s: Settings) {
  return {
    ...DEFAULT_ROTATION,
    size: s.roundSize,
    mix: s.contentMix,
    cooldownDays: s.cooldownDays,
    maxPerTopic: s.maxPerTopic,
    maxPerFormat: s.maxPerFormat,
    staleDays: s.staleDays,
  };
}
