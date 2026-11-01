/**
 * Svaralternativer til tallspørsmål («linjalen»).
 *
 * Alternativene lages på serveren fra fasiten, men skal ikke avsløre den:
 *  - fasit ligger på tilfeldig plass (0–3) blant alternativene, og alternativene vises stigende,
 *  - avstanden mellom alternativene varierer fra spørsmål til spørsmål,
 *  - alle tall rundes like grovt som fasit (ellers ville det «uavrundede» tallet vært fasit).
 * Poengberegningen er uendret: du får fortsatt poeng etter hvor nær du er, og 100 for riktig alternativ.
 */
import type { Payload } from "./schema";

type EstimatePayload = Extract<Payload, { format: "estimate" }>;

export const OPTION_COUNT = 4;

/** Største 10^k (k kan være negativ) som fasit er et helt multiplum av. */
export function granularity(answer: number): number {
  if (!Number.isFinite(answer) || answer === 0) return 1;
  const s = String(Math.abs(answer));
  if (s.includes("e")) return 1;
  const dec = s.split(".")[1];
  if (dec) return Number(`1e-${dec.length}`);
  const int = s.replace(/0+$/, "");
  return Number(`1e${s.length - int.length}`);
}

function roundTo(v: number, g: number): number {
  const decimals = g < 1 ? Math.round(-Math.log10(g)) : 0;
  return Number((Math.round(v / g) * g).toFixed(decimals));
}

/** Avstand mellom to verdier målt i «feil-enheter» (samme mål som poengberegningen). */
function distance(a: number, b: number, scale: "linear" | "log", tolerance: number): number {
  if (scale === "log") return Math.abs(Math.log(a / b)) / tolerance;
  return Math.abs(a - b) / tolerance;
}

const JITTER = 0.2;
/** Minste avstand mellom alternativer, i «toleranser» (nabo-alternativ skal ikke være nesten like riktig). */
const MIN_SPACING = 0.6;
/** Foretrukket nedre grense når skalaen gir plass (ellers presses alternativene tettere). */
const PREFERRED_SPACING = 1.1;
const MAX_SPACING = 2;

/** Bygger alternativene med fasit på plass k. Null hvis noe havner utenfor skalaen eller faller sammen. */
function build(p: EstimatePayload, rand: () => number, g: number, k: number, spacing: number, count: number): number[] | null {
  const out: number[] = [];
  for (let i = 0; i < count; i++) {
    if (i === k) {
      out.push(p.answer);
      continue;
    }
    const steps = i - k + (rand() - 0.5) * 2 * JITTER;
    const raw = p.scale === "log" ? p.answer * Math.exp(steps * spacing) : p.answer + steps * spacing;
    const v = roundTo(raw, g);
    if (!(v >= p.min && v <= p.max) || (p.scale === "log" && v <= 0)) return null;
    out.push(v);
  }
  for (let i = 1; i < out.length; i++) {
    if (!(out[i] > out[i - 1])) return null;
    if (distance(out[i], out[i - 1], p.scale, p.tolerance) < MIN_SPACING * (1 - 2 * JITTER) - 0.05) return null;
  }
  return out;
}

/**
 * Fire alternativer (fasit + tre andre), stigende. Fasit får en jevnt tilfeldig plass blant de plassene
 * som skalaen rommer. Gir tom liste hvis det ikke går an å lage gode alternativer – da bruker klienten
 * bare målebåndet.
 */
export function estimateOptions(p: EstimatePayload, rand: () => number, count = OPTION_COUNT): number[] {
  const g = granularity(p.answer);
  const below = (p.scale === "log" ? Math.log(p.answer / p.min) : p.answer - p.min) / p.tolerance;
  const above = (p.scale === "log" ? Math.log(p.max / p.answer) : p.max - p.answer) / p.tolerance;
  const room = (k: number) => Math.min(k > 0 ? below / (k + JITTER) : Infinity, count - 1 - k > 0 ? above / (count - 1 - k + JITTER) : Infinity);
  const feasible = Array.from({ length: count }, (_, k) => k).filter((k) => room(k) >= MIN_SPACING);
  if (feasible.length === 0) return [];
  for (let tries = 0; tries < 60; tries++) {
    const k = feasible[Math.floor(rand() * feasible.length)];
    const hi = Math.min(MAX_SPACING, room(k) * 0.97);
    const lo = Math.max(MIN_SPACING, Math.min(PREFERRED_SPACING, hi * 0.9));
    const spacing = (lo + rand() * Math.max(0, hi - lo)) * p.tolerance;
    const r = build(p, rand, g, k, spacing, count);
    if (r) return r;
  }
  return [];
}
