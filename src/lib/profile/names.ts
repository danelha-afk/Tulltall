/**
 * Spillernavn: genererte navn («Modig Elg 42») og filter for selvvalgte navn.
 * Genererte navn gjør at ingen – særlig ikke barn – må bruke sitt eget navn på topplister.
 */
import { hashString, mulberry32 } from "../game/prng";

// Bare adjektiver som ikke bøyes i hankjønn/hunkjønn, og bare hankjønns-/hunkjønnsord.
const ADJECTIVES = [
  "Modig", "Lur", "Kjapp", "Rolig", "Smart", "Snill", "Sprek", "Glad", "Tapper", "Flink",
  "Kry", "Våken", "Freidig", "Livlig", "Klok", "Sindig", "Frisk", "Rask", "Varm", "Stolt",
];
const ANIMALS = [
  "Elg", "Ulv", "Rev", "Oter", "Hare", "Ugle", "Bjørn", "Gaupe", "Hval", "Måke",
  "Ørn", "Hjort", "Grevling", "Geit", "Torsk", "Laks", "Spurv", "Hubro", "Fjellrev", "Lundefugl",
];

/** Samme seed gir alltid samme navn. */
export function generateHandle(seed: string): string {
  const r = mulberry32(hashString(`navn:${seed}`));
  const adj = ADJECTIVES[Math.floor(r() * ADJECTIVES.length)];
  const animal = ANIMALS[Math.floor(r() * ANIMALS.length)];
  const n = 10 + Math.floor(r() * 90);
  return `${adj} ${animal} ${n}`;
}

export function normalizeForFilter(s: string): string {
  return s
    .toLowerCase()
    .replace(/æ/g, "ae")
    .replace(/ø/g, "o")
    .replace(/å/g, "a")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/0/g, "o")
    .replace(/[1!|]/g, "i")
    .replace(/3/g, "e")
    .replace(/[4@]/g, "a")
    .replace(/[5$]/g, "s")
    .replace(/7/g, "t")
    .replace(/[^a-z]/g, "")
    .replace(/(.)\1+/g, "$1");
}

// Lengre ord sjekkes som delstreng (etter normalisering), korte bare som hele ord.
const BLOCKED_LONG = [
  "faen", "helvete", "jaevla", "jaevel", "fitte", "pikk", "hore", "dritt", "drittsekk", "fuck", "shit",
  "bitch", "cunt", "whore", "slut", "nigger", "neger", "retard", "mongo", "spasser", "nazi", "hitler",
  "porno", "pedo", "voldta", "idiot",
].map(normalizeForFilter);
const BLOCKED_SHORT = new Set(["kuk", "fag", "sex", "pik", "anal", "kkk", "isis"].map(normalizeForFilter));

export type HandleError = "short" | "long" | "chars" | "blocked" | "personal";

export function validateHandle(input: string): { ok: true; value: string } | { ok: false; error: HandleError } {
  const value = input.normalize("NFC").replace(/\s+/g, " ").trim();
  if (value.length < 3) return { ok: false, error: "short" };
  if (value.length > 20) return { ok: false, error: "long" };
  if (!/^[\p{L}\p{N} _-]+$/u.test(value)) return { ok: false, error: /@|https?:|www\./i.test(value) ? "personal" : "chars" };
  if (/\d{6,}/.test(value.replace(/[ _-]/g, "")) || /\.(no|com|net|org)\b/i.test(value)) return { ok: false, error: "personal" };
  const joined = normalizeForFilter(value);
  const tokens = value.split(/[^\p{L}\p{N}]+/u).filter(Boolean).map(normalizeForFilter);
  if (BLOCKED_LONG.some((w) => joined.includes(w)) || tokens.some((t) => BLOCKED_SHORT.has(t))) return { ok: false, error: "blocked" };
  return { ok: true, value };
}

export function isAcceptableNickname(input: string): boolean {
  return validateHandle(input).ok;
}
