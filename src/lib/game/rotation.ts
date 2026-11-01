/**
 * Rotasjonsalgoritmen som setter sammen daglige runder.
 *
 * Mål: variasjon, balansert innholdsmiks (konfigurerbar, standard 60/30/10), riktig rytme
 * (lett åpning, finale til slutt, ingen to like formater på rad), og at samme spørsmål
 * ikke dukker opp for ofte. Algoritmen er ren og deterministisk: samme pool + dato + frø
 * gir samme runde – men den publiserte runden fryses uansett i databasen.
 */
import type { Category, Format, Risk, Tone } from "./schema";
import { seededRandom, shuffle } from "./prng";
import { daysBetween } from "./dates";

export interface PoolQuestion {
  id: string;
  category: Category;
  topic: string;
  format: Format;
  difficulty: number;
  risk: Risk;
  tone: Tone;
  dataQuality: number;
  exposureCount: number;
  lastUsedOn: string | null;
  seasonMonths: number[];
  lastVerified: string;
  /** Intern prioritet 0–1 (fra redaksjonelle anslag, senere kalibrert med brukerdata). */
  priority?: number;
  /** Handler om likestilling/mangfold (se themes.ts). Det er en hard grense per runde. */
  equality?: boolean;
}

export interface ContentMix {
  fun: number;
  misconception: number;
  current: number;
}

export interface RotationConfig {
  size: number;
  mix: ContentMix;
  cooldownDays: number;
  maxPerTopic: number;
  maxPerFormat: number;
  maxHighRisk: number;
  /** Høyst så mange spørsmål per runde om likestilling/mangfold. Lempes aldri. */
  maxEquality: number;
  /** Spørsmål som ikke er kontrollert på så mange dager, brukes ikke. */
  staleDays: number;
}

export const DEFAULT_ROTATION: RotationConfig = {
  size: 10,
  mix: { fun: 0.6, misconception: 0.3, current: 0.1 },
  cooldownDays: 60,
  maxPerTopic: 2,
  maxPerFormat: 4,
  maxHighRisk: 1,
  maxEquality: 1,
  staleDays: 548,
};

export interface RotationResult {
  questionIds: string[];
  diagnostics: {
    targets: Record<Category, number>;
    picked: Record<Category, number>;
    cooldownUsed: number;
    relaxations: string[];
    poolSize: number;
  };
}

/** Fordel `size` plasser etter miks med største-rest-metoden. */
export function categoryTargets(size: number, mix: ContentMix): Record<Category, number> {
  const cats: Category[] = ["fun", "misconception", "current"];
  const total = cats.reduce((s, c) => s + Math.max(0, mix[c]), 0) || 1;
  const raw = cats.map((c) => (Math.max(0, mix[c]) / total) * size);
  const base = raw.map(Math.floor);
  let rest = size - base.reduce((s, n) => s + n, 0);
  const order = raw.map((r, i) => ({ i, frac: r - Math.floor(r) })).sort((a, b) => b.frac - a.frac);
  for (const { i } of order) {
    if (rest <= 0) break;
    base[i]++;
    rest--;
  }
  return { fun: base[0], misconception: base[1], current: base[2] };
}

export function questionWeight(q: PoolQuestion, date: string): number {
  const month = Number(date.slice(5, 7));
  const novelty = q.exposureCount === 0 ? 1.6 : 1 / Math.sqrt(1 + q.exposureCount);
  const quality = 0.6 + 0.1 * q.dataQuality;
  const season = q.seasonMonths.length === 0 ? 1 : q.seasonMonths.includes(month) ? 2.2 : 0.15;
  const recency = q.lastUsedOn ? Math.min(1, Math.max(0, daysBetween(q.lastUsedOn, date)) / 120) + 0.2 : 1.2;
  const priority = 0.5 + (q.priority ?? 0.5);
  return novelty * quality * season * recency * priority;
}

function weightedPick<T>(items: T[], weights: number[], rand: () => number): T | undefined {
  const total = weights.reduce((s, w) => s + w, 0);
  if (items.length === 0 || total <= 0) return items[0];
  let r = rand() * total;
  for (let i = 0; i < items.length; i++) {
    r -= weights[i];
    if (r <= 0) return items[i];
  }
  return items[items.length - 1];
}

export function composeDailyGame(
  pool: PoolQuestion[],
  date: string,
  config: RotationConfig = DEFAULT_ROTATION,
  salt = "tulltall",
): RotationResult {
  const rand = seededRandom(`${salt}:${date}`);
  const relaxations: string[] = [];
  const fresh = pool.filter((q) => daysBetween(q.lastVerified, date) <= config.staleDays);
  if (fresh.length < pool.length) relaxations.push(`${pool.length - fresh.length} utdaterte spørsmål utelatt`);

  const targets = categoryTargets(Math.min(config.size, fresh.length), config.mix);
  const want = Math.min(config.size, fresh.length);

  // Karantene (cooldown) med gradvis lemping hvis banken er for liten.
  const cooldowns = [config.cooldownDays, Math.floor(config.cooldownDays / 2), 14, 3, 0];
  let eligible: PoolQuestion[] = [];
  let cooldownUsed = 0;
  for (const cd of cooldowns) {
    eligible = fresh.filter((q) => !q.lastUsedOn || daysBetween(q.lastUsedOn, date) > cd || q.lastUsedOn > date);
    eligible = eligible.filter((q) => q.lastUsedOn !== date);
    cooldownUsed = cd;
    const enough = (["fun", "misconception", "current"] as Category[]).every(
      (c) => eligible.filter((q) => q.category === c).length >= targets[c],
    );
    if (enough && eligible.length >= want) break;
  }
  if (cooldownUsed < config.cooldownDays) relaxations.push(`karantene lempet til ${cooldownUsed} dager`);

  const picked: PoolQuestion[] = [];
  const topicCount = new Map<string, number>();
  const formatCount = new Map<string, number>();
  let highRisk = 0;
  let equality = 0;

  const fits = (q: PoolQuestion, level: number) => {
    if (picked.some((p) => p.id === q.id)) return false;
    // Hard grense (aldri lempet): bare ett spørsmål om likestilling/mangfold per runde.
    if (q.equality && equality >= config.maxEquality) return false;
    if (level < 3 && q.risk === "high" && highRisk >= config.maxHighRisk) return false;
    if (level < 2 && (topicCount.get(q.topic) ?? 0) >= config.maxPerTopic) return false;
    if (level < 1 && (formatCount.get(q.format) ?? 0) >= config.maxPerFormat) return false;
    return true;
  };
  const take = (q: PoolQuestion) => {
    picked.push(q);
    topicCount.set(q.topic, (topicCount.get(q.topic) ?? 0) + 1);
    formatCount.set(q.format, (formatCount.get(q.format) ?? 0) + 1);
    if (q.risk === "high") highRisk++;
    if (q.equality) equality++;
  };
  const pickFrom = (cands: PoolQuestion[]) => {
    for (let level = 0; level <= 3; level++) {
      const ok = cands.filter((q) => fits(q, level));
      if (ok.length) {
        if (level > 0) relaxations.push(`begrensning lempet (nivå ${level})`);
        const q = weightedPick(ok, ok.map((x) => questionWeight(x, date)), rand);
        if (q) return q;
      }
    }
    return undefined;
  };

  // En lett, leken åpner sikres først (hvis den finnes).
  const openers = eligible.filter((q) => q.category === "fun" && q.difficulty <= 2 && q.tone === "playful");
  if (targets.fun > 0 && openers.length) {
    const q = pickFrom(openers);
    if (q) take(q);
  }

  // Knappe kategorier først, så de ikke blir utkonkurrert av begrensninger.
  for (const cat of ["current", "misconception", "fun"] as Category[]) {
    while (picked.filter((p) => p.category === cat).length < targets[cat]) {
      const q = pickFrom(eligible.filter((x) => x.category === cat));
      if (!q) break;
      take(q);
    }
  }
  // Fyll opp hvis en kategori manglet innhold.
  while (picked.length < want) {
    const q = pickFrom(eligible);
    if (!q) break;
    relaxations.push(`fylt opp med ${q.category}`);
    take(q);
  }

  const ordered = orderRound(picked, rand);
  const count = (c: Category) => ordered.filter((q) => q.category === c).length;
  return {
    questionIds: ordered.map((q) => q.id),
    diagnostics: {
      targets,
      picked: { fun: count("fun"), misconception: count("misconception"), current: count("current") },
      cooldownUsed,
      relaxations: [...new Set(relaxations)],
      poolSize: pool.length,
    },
  };
}

/**
 * Rytme: lett åpner → spredte innsiktsspørsmål → finale. Ingen like formater på rad når det
 * kan unngås, og alvorlige spørsmål kommer verken først eller sist.
 */
export function orderRound(qs: PoolQuestion[], rand: () => number): PoolQuestion[] {
  if (qs.length <= 2) return [...qs];
  const remaining = shuffle(qs, rand);
  const byEase = [...remaining].sort((a, b) => a.difficulty - b.difficulty || toneRank(a.tone) - toneRank(b.tone));
  const opener = byEase.find((q) => q.category === "fun" && q.tone !== "serious") ?? byEase.find((q) => q.tone !== "serious") ?? byEase[0];
  remaining.splice(remaining.indexOf(opener), 1);

  const finaleCands = remaining
    .filter((q) => q.tone !== "serious" && q.risk !== "high")
    .sort((a, b) => (b.priority ?? 0.5) + b.difficulty * 0.1 - ((a.priority ?? 0.5) + a.difficulty * 0.1));
  const finale = finaleCands[0] ?? remaining[remaining.length - 1];
  remaining.splice(remaining.indexOf(finale), 1);

  // Spre ikke-moro-spørsmål jevnt over midtpartiet.
  const middleLen = remaining.length;
  const nonFun = remaining.filter((q) => q.category !== "fun");
  const fun = remaining.filter((q) => q.category === "fun");
  const slots: ("x" | "f")[] = Array(middleLen).fill("f");
  nonFun.forEach((_, k) => {
    const pos = Math.min(middleLen - 1, Math.round(((k + 1) * (middleLen + 1)) / (nonFun.length + 1)) - 1);
    let p = Math.max(0, pos);
    while (slots[p] === "x" && p < middleLen - 1) p++;
    while (slots[p] === "x" && p > 0) p--;
    slots[p] = "x";
  });

  const out: PoolQuestion[] = [opener];
  for (const slot of slots) {
    const pool = slot === "x" ? nonFun : fun;
    const fallback = slot === "x" ? fun : nonFun;
    const prev = out[out.length - 1];
    const source = pool.length ? pool : fallback;
    const idx = source.findIndex((q) => q.format !== prev.format && !(q.tone === "serious" && prev.tone === "serious"));
    const chosen = source.splice(idx >= 0 ? idx : 0, 1)[0];
    out.push(chosen);
  }
  out.push(finale);
  return out;
}

function toneRank(t: Tone): number {
  return t === "playful" ? 0 : t === "neutral" ? 1 : 2;
}
