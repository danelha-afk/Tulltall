/** Topplister. Bare spillere som selv har sagt ja (og ikke er skjult av redaksjonen) vises med navn. */
import type { Db } from "../db/client";

export interface TopRow {
  rank: number;
  handle: string;
  score: number;
  hits: number;
  total: number;
}

export interface MyRank {
  rank: number;
  total: number;
  score: number;
}

const VISIBLE = `p.show_on_lists AND NOT p.hidden_by_admin AND p.handle IS NOT NULL`;

export async function topDaily(db: Db, date: string, limit = 10): Promise<TopRow[]> {
  const rows = await db.query<Omit<TopRow, "rank">>(
    `SELECT p.handle, s.score, s.hits, jsonb_array_length(s.question_ids)::int AS total
     FROM sessions s JOIN games g ON g.id = s.game_id JOIN players p ON p.id = s.player_id
     WHERE g.kind = 'daily' AND g.game_date = $1 AND s.finished_at IS NOT NULL AND ${VISIBLE}
     ORDER BY s.score DESC, s.finished_at ASC LIMIT $2`,
    [date, limit],
  );
  return rows.map((r, i) => ({ ...r, rank: i + 1 }));
}

/** Uka: samlet poengsum for dagens runder (mandag–søndag). */
export async function topWeekly(db: Db, start: string, end: string, limit = 10): Promise<TopRow[]> {
  const rows = await db.query<Omit<TopRow, "rank">>(
    `SELECT p.handle, sum(s.score)::int AS score, sum(s.hits)::int AS hits, sum(jsonb_array_length(s.question_ids))::int AS total
     FROM sessions s JOIN games g ON g.id = s.game_id JOIN players p ON p.id = s.player_id
     WHERE g.kind = 'daily' AND g.game_date BETWEEN $1 AND $2 AND s.finished_at IS NOT NULL AND ${VISIBLE}
     GROUP BY p.id, p.handle ORDER BY score DESC, max(s.finished_at) ASC LIMIT $3`,
    [start, end, limit],
  );
  return rows.map((r, i) => ({ ...r, rank: i + 1 }));
}

/** Plassering blant alle som har fullført (også dem som ikke vises på listen). */
export async function myRankDaily(db: Db, date: string, playerId: string): Promise<MyRank | null> {
  const mine = await db.one<{ score: number }>(
    `SELECT s.score FROM sessions s JOIN games g ON g.id = s.game_id
     WHERE s.player_id = $1 AND g.kind = 'daily' AND g.game_date = $2 AND s.finished_at IS NOT NULL LIMIT 1`,
    [playerId, date],
  );
  if (!mine) return null;
  const c = await db.one<{ better: number; total: number }>(
    `SELECT count(*) FILTER (WHERE s.score > $2)::int AS better, count(*)::int AS total
     FROM sessions s JOIN games g ON g.id = s.game_id
     WHERE g.kind = 'daily' AND g.game_date = $1 AND s.finished_at IS NOT NULL`,
    [date, mine.score],
  );
  return { rank: (c?.better ?? 0) + 1, total: c?.total ?? 1, score: mine.score };
}

export async function myRankWeekly(db: Db, start: string, end: string, playerId: string): Promise<MyRank | null> {
  const rows = await db.query<{ player_id: string; score: number }>(
    `SELECT s.player_id, sum(s.score)::int AS score FROM sessions s JOIN games g ON g.id = s.game_id
     WHERE g.kind = 'daily' AND g.game_date BETWEEN $1 AND $2 AND s.finished_at IS NOT NULL GROUP BY s.player_id`,
    [start, end],
  );
  const mine = rows.find((r) => r.player_id === playerId);
  if (!mine) return null;
  return { rank: rows.filter((r) => r.score > mine.score).length + 1, total: rows.length, score: mine.score };
}
