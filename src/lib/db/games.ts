/**
 * Daglige runder og enkeltspørsmål. En daglig runde lagres og fryses når den publiseres,
 * slik at alle som spiller samme dag – og alle som får en utfordringslenke – får identiske spørsmål.
 */
import type { Db } from "./client";
import { getQuestionRows, rotationPool, type QuestionRow } from "./questions";
import { composeDailyGame } from "../game/rotation";
import { getSettings, rotationConfigFrom } from "./settings";
import { addDays } from "../game/dates";

export interface GameRow {
  id: string;
  kind: "daily" | "single" | "custom";
  game_date: string | null;
  question_ids: string[];
  seed: string;
  status: "scheduled" | "published" | "retired";
  generator: Record<string, unknown>;
  created_at: Date;
  locked_at: Date | null;
}

export const dailyGameId = (date: string) => `d-${date}`;
export const singleGameId = (questionId: string) => `q-${questionId}`;

export async function getGame(db: Db, id: string): Promise<GameRow | undefined> {
  return db.one<GameRow>(`SELECT * FROM games WHERE id = $1`, [id]);
}

/** Lager (om nødvendig) den daglige runden for en dato. Trygg ved samtidige kall. */
export async function ensureDailyGame(db: Db, date: string): Promise<GameRow | undefined> {
  const existing = await db.one<GameRow>(`SELECT * FROM games WHERE kind = 'daily' AND game_date = $1`, [date]);
  if (existing) return existing;

  const settings = await getSettings(db);
  const pool = await rotationPool(db);
  if (pool.length === 0) return undefined;
  const result = composeDailyGame(pool, date, rotationConfigFrom(settings), process.env.ROTATION_SALT ?? "tulltall");
  if (result.questionIds.length === 0) return undefined;

  return db.tx(async (tx) => {
    const inserted = await tx.one<GameRow>(
      `INSERT INTO games (id, kind, game_date, question_ids, seed, status, generator)
       VALUES ($1, 'daily', $2, $3::jsonb, $4, 'scheduled', $5::jsonb)
       ON CONFLICT DO NOTHING RETURNING *`,
      [dailyGameId(date), date, JSON.stringify(result.questionIds), `daily:${date}`, JSON.stringify(result.diagnostics)],
    );
    if (!inserted) {
      return (await tx.one<GameRow>(`SELECT * FROM games WHERE kind = 'daily' AND game_date = $1`, [date]))!;
    }
    // Registrer eksponering slik at rotasjonen unngår gjentakelser.
    await tx.query(
      `UPDATE questions SET exposure_count = exposure_count + 1,
              last_used_on = CASE WHEN last_used_on IS NULL OR last_used_on < $2 THEN $2 ELSE last_used_on END
       WHERE id = ANY($1::text[])`,
      [result.questionIds, date],
    );
    return inserted;
  });
}

/** Publiserer (låser) runden for en dato – kalles når dagen starter eller når første spiller kommer. */
export async function publishDailyGame(db: Db, date: string): Promise<GameRow | undefined> {
  const game = await ensureDailyGame(db, date);
  if (!game) return undefined;
  if (game.status === "published") return game;
  const updated = await db.one<GameRow>(
    `UPDATE games SET status = 'published', locked_at = COALESCE(locked_at, now()) WHERE id = $1 RETURNING *`,
    [game.id],
  );
  await db.query(
    `UPDATE questions SET status = 'published', published_at = COALESCE(published_at, now()), updated_at = now()
     WHERE id = ANY($1::text[]) AND status = 'approved'`,
    [game.question_ids],
  );
  return updated;
}

/** Planlegger de neste `days` dagene fortløpende (rotasjonen tar hensyn til tidligere dager). */
export async function scheduleUpcoming(db: Db, fromDate: string, days: number): Promise<GameRow[]> {
  const out: GameRow[] = [];
  for (let i = 0; i < days; i++) {
    const g = await ensureDailyGame(db, addDays(fromDate, i));
    if (g) out.push(g);
  }
  return out;
}

/** Lager en ny runde for en fremtidig dato på nytt (f.eks. etter at et spørsmål er trukket). */
export async function regenerateDailyGame(db: Db, date: string): Promise<GameRow | undefined> {
  const game = await db.one<GameRow>(`SELECT * FROM games WHERE kind = 'daily' AND game_date = $1`, [date]);
  if (game?.locked_at) throw new Error("Runden er allerede publisert og låst");
  if (game) {
    const used = await db.one<{ n: number }>(`SELECT count(*)::int AS n FROM sessions WHERE game_id = $1`, [game.id]);
    if ((used?.n ?? 0) > 0) throw new Error("Runden har allerede spillere");
    await db.query(
      `UPDATE questions SET exposure_count = GREATEST(0, exposure_count - 1),
              last_used_on = CASE WHEN last_used_on = $2 THEN NULL ELSE last_used_on END
       WHERE id = ANY($1::text[])`,
      [game.question_ids, date],
    );
    await db.query(`DELETE FROM games WHERE id = $1`, [game.id]);
  }
  return ensureDailyGame(db, date);
}

export async function ensureSingleGame(db: Db, questionId: string): Promise<GameRow | undefined> {
  const q = await db.one<{ id: string; status: string }>(`SELECT id, status FROM questions WHERE id = $1`, [questionId]);
  if (!q || !["approved", "published"].includes(q.status)) return undefined;
  const id = singleGameId(questionId);
  await db.query(
    `INSERT INTO games (id, kind, question_ids, seed, status, locked_at)
     VALUES ($1, 'single', $2::jsonb, $3, 'published', now()) ON CONFLICT (id) DO NOTHING`,
    [id, JSON.stringify([questionId]), `single:${questionId}`],
  );
  return getGame(db, id);
}

/** Spørsmålene som faktisk serveres: tilbaketrukne (arkiverte) spørsmål filtreres bort. */
export async function servedQuestions(db: Db, game: GameRow): Promise<QuestionRow[]> {
  const rows = await getQuestionRows(db, game.question_ids);
  return rows.filter((r) => r.status !== "archived");
}

export async function upcomingGames(db: Db, fromDate: string, days = 14) {
  return db.query<GameRow & { players: number }>(
    `SELECT g.*, (SELECT count(*)::int FROM sessions s WHERE s.game_id = g.id) AS players
     FROM games g WHERE g.kind = 'daily' AND g.game_date >= $1 AND g.game_date < $2 ORDER BY g.game_date`,
    [fromDate, addDays(fromDate, days)],
  );
}
