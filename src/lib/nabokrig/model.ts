/**
 * Nabokrigens poengmodell.
 *
 * Problem: Rå summer lar de største kommunene vinne bare fordi de har flest innbyggere,
 * mens rene snitt lar én heldig spiller i en liten kommune vinne alene.
 *
 * Løsning – ukepoeng (0–100) = 75 % kunnskap + 25 % engasjement:
 *  1. Kunnskap: bayesiansk krympet snitt av kommunens tellende runder. Med få runder trekkes
 *     snittet mot landssnittet (C «pseudo-runder»), så tilfeldigheter ikke avgjør. Snittet
 *     uttrykkes relativt til landssnittet (±spread poeng ⇒ 0–1), så skalaen er stabil fra uke til uke.
 *  2. Engasjement: aktive spillere per 1000 innbyggere, log-skalert og mettet ved et mål
 *     (standard 5 per 1000). Små kommuner kan konkurrere, men ekstrem deltakelse kan ikke
 *     kompensere for svak kunnskap.
 *  3. Minsteterskel: en kommune må ha minst `minPlayers` ulike spillere for å rangeres.
 *
 * Modellen er dokumentert og testet i docs/nabokrigen-poengmodell.md og tests/nabokrig.test.ts.
 */

export interface KommuneWeekInput {
  nr: string;
  population: number;
  /** Poengsum (0–1000) for hver tellende runde denne uken. */
  scores: number[];
  /** Antall ulike spillere. */
  players: number;
}

export interface ModelParams {
  /** Vekt for kunnskap (resten er engasjement). */
  skillWeight: number;
  /** Hvor mange poeng over/under landssnittet som gir full/null kunnskapsscore. */
  spread: number;
  /** Spillere per 1000 innbyggere som gir full engasjementsscore. */
  engagementTarget: number;
  /** Antall «pseudo-runder» som trekker snittet mot landssnittet. */
  shrinkage: number;
  minPlayers: number;
  /** Maks poeng per runde. */
  maxRoundScore: number;
}

export const DEFAULT_PARAMS: ModelParams = {
  skillWeight: 0.75,
  spread: 100,
  engagementTarget: 5,
  shrinkage: 20,
  minPlayers: 5,
  maxRoundScore: 1000,
};

export interface KommuneWeekResult {
  nr: string;
  ranked: boolean;
  players: number;
  plays: number;
  rawMean: number;
  shrunkMean: number;
  playersPerThousand: number;
  skill: number; // 0–1
  engagement: number; // 0–1
  points: number; // 0–100
  rank: number | null;
}

export function computeWeek(inputs: KommuneWeekInput[], params: ModelParams = DEFAULT_PARAMS): KommuneWeekResult[] {
  const allScores = inputs.flatMap((k) => k.scores);
  const nationalMean = allScores.length ? allScores.reduce((s, x) => s + x, 0) / allScores.length : params.maxRoundScore / 2;

  const partial = inputs.map((k) => {
    const plays = k.scores.length;
    const sum = k.scores.reduce((s, x) => s + x, 0);
    const rawMean = plays ? sum / plays : 0;
    const shrunkMean = (sum + params.shrinkage * nationalMean) / (plays + params.shrinkage);
    const perThousand = k.population > 0 ? (k.players / k.population) * 1000 : 0;
    return { k, plays, rawMean, shrunkMean, perThousand };
  });

  const engDenominator = Math.log1p(params.engagementTarget);

  const results: KommuneWeekResult[] = partial.map((p) => {
    const skill = Math.min(1, Math.max(0, 0.5 + (p.shrunkMean - nationalMean) / (2 * params.spread)));
    const engagement = Math.min(1, Math.log1p(p.perThousand) / engDenominator);
    const points = Math.round(1000 * (params.skillWeight * skill + (1 - params.skillWeight) * engagement)) / 10;
    return {
      nr: p.k.nr,
      ranked: p.k.players >= params.minPlayers,
      players: p.k.players,
      plays: p.plays,
      rawMean: Math.round(p.rawMean),
      shrunkMean: Math.round(p.shrunkMean),
      playersPerThousand: Math.round(p.perThousand * 100) / 100,
      skill,
      engagement,
      points,
      rank: null,
    };
  });

  const order = results
    .filter((r) => r.ranked)
    .sort((a, b) => b.points - a.points || b.players - a.players || a.nr.localeCompare(b.nr));
  order.forEach((r, i) => (r.rank = i + 1));
  return results.sort((a, b) => (a.rank ?? 1e9) - (b.rank ?? 1e9) || b.players - a.players);
}
