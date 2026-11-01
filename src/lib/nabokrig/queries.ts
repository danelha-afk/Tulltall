/** Datauttrekk for Nabokrigen (ukestabell, kommunesider, dueller). */
import type { Db } from "../db/client";
import { computeWeek, DEFAULT_PARAMS, type KommuneWeekResult } from "./model";
import { weekRange } from "../game/dates";
import { getSettings } from "../db/settings";

export interface KommuneRow {
  nr: string;
  name: string;
  slug: string;
  fylke_nr: string;
  fylke_name: string;
  alt_names: string[];
  population: number | null;
  population_date: string | null;
  population_source: string | null;
  area_km2: number | null;
}

export async function listKommuner(db: Db): Promise<KommuneRow[]> {
  return db.query<KommuneRow>(`SELECT * FROM kommuner ORDER BY name`);
}

export async function kommuneBySlug(db: Db, slug: string): Promise<KommuneRow | undefined> {
  return db.one<KommuneRow>(`SELECT * FROM kommuner WHERE slug = $1`, [slug]);
}

export async function kommuneByNr(db: Db, nr: string): Promise<KommuneRow | undefined> {
  return db.one<KommuneRow>(`SELECT * FROM kommuner WHERE nr = $1`, [nr]);
}

export type StandingRow = KommuneWeekResult & { name: string; slug: string; fylke: string };

/** Ukestabell for uken som inneholder `date`. Beste runde per spiller per dag teller. */
export async function weeklyStandings(db: Db, date: string): Promise<StandingRow[]> {
  const { start, end } = weekRange(date);
  const settings = await getSettings(db);
  const rows = await db.query<{ kommune_nr: string; player_id: string; score: number }>(
    `SELECT s.kommune_nr, s.player_id, s.score
     FROM sessions s JOIN games g ON g.id = s.game_id
     WHERE s.counted_for_kommune AND g.kind = 'daily' AND g.game_date BETWEEN $1 AND $2`,
    [start, end],
  );
  const kommuner = await db.query<KommuneRow>(
    `SELECT * FROM kommuner WHERE nr = ANY($1::text[])`,
    [[...new Set(rows.map((r) => r.kommune_nr))]],
  );
  const byNr = new Map(kommuner.map((k) => [k.nr, k]));
  const grouped = new Map<string, { scores: number[]; players: Set<string> }>();
  for (const r of rows) {
    const g = grouped.get(r.kommune_nr) ?? { scores: [], players: new Set<string>() };
    g.scores.push(r.score);
    g.players.add(r.player_id);
    grouped.set(r.kommune_nr, g);
  }
  const results = computeWeek(
    [...grouped.entries()].map(([nr, g]) => ({
      nr,
      population: byNr.get(nr)?.population ?? 0,
      scores: g.scores,
      players: g.players.size,
    })),
    { ...DEFAULT_PARAMS, minPlayers: settings.nabokrigMinPlayers },
  );
  return results.map((r) => {
    const k = byNr.get(r.nr);
    return { ...r, name: k?.name ?? r.nr, slug: k?.slug ?? r.nr, fylke: k?.fylke_name ?? "" };
  });
}

/** Kjente rivaliseringer som foreslås på Nabokrig-siden. */
export const RIVALRIES: [string, string][] = [
  ["3203", "3201"], // Asker – Bærum
  ["4601", "1103"], // Bergen – Stavanger
  ["5501", "5001"], // Tromsø – Trondheim
  ["3301", "3107"], // Drammen – Fredrikstad
  ["3107", "3105"], // Fredrikstad – Sarpsborg
  ["1103", "1108"], // Stavanger – Sandnes
  ["4204", "4203"], // Kristiansand – Arendal
  ["3403", "3405"], // Hamar – Lillehammer
  ["1508", "1505"], // Ålesund – Kristiansund
  ["1804", "5501"], // Bodø – Tromsø
];
