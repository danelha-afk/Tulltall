/**
 * A/B-tester: deterministisk tildeling per spiller (samme spiller får alltid samme variant).
 * Ingen tildeling uten aktiv test. Resultater analyseres i administrasjonens analysepanel.
 */
import type { Experiment } from "../db/settings";
import { hashString } from "../game/prng";

export function assignVariant(playerId: string, exp: Experiment): string {
  const r = (hashString(`${exp.key}:${playerId}`) % 10_000) / 10_000;
  const total = exp.weights.reduce((s, w) => s + w, 0) || 1;
  let acc = 0;
  for (let i = 0; i < exp.variants.length; i++) {
    acc += (exp.weights[i] ?? 0) / total;
    if (r < acc) return exp.variants[i];
  }
  return exp.variants[exp.variants.length - 1];
}

export function assignVariants(playerId: string, experiments: Experiment[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const e of experiments) if (e.active) out[e.key] = assignVariant(playerId, e);
  return out;
}
