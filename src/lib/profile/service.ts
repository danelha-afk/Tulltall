import type { Db } from "../db/client";
import { UUID_RE } from "../security/crypto";
import { localDate, weekRange } from "../game/dates";
import { myRankDaily, myRankWeekly, type MyRank } from "../toplist/queries";
import { generateHandle, validateHandle, type HandleError } from "./names";

export interface Profile {
  handle: string;
  custom: boolean;
  showOnLists: boolean;
  hidden: boolean;
  runs: number;
  best: number | null;
  today: MyRank | null;
  week: MyRank | null;
}

export type UpdateError = HandleError | "taken" | "not_found";

interface PlayerRow {
  id: string;
  handle: string | null;
  handle_custom: boolean;
  show_on_lists: boolean;
  hidden_by_admin: boolean;
}

export async function ensureHandle(db: Db, playerId: string): Promise<void> {
  await db.query(`UPDATE players SET handle = $2 WHERE id = $1 AND handle IS NULL`, [playerId, generateHandle(playerId)]);
}

export async function getProfile(db: Db, playerId: string, today = localDate()): Promise<Profile | null> {
  if (!UUID_RE.test(playerId)) return null;
  await ensureHandle(db, playerId);
  const p = await db.one<PlayerRow>(`SELECT id, handle, handle_custom, show_on_lists, hidden_by_admin FROM players WHERE id = $1`, [playerId]);
  if (!p) return null;
  const stats = await db.one<{ runs: number; best: number | null }>(
    `SELECT count(*)::int AS runs, max(s.score)::int AS best FROM sessions s JOIN games g ON g.id = s.game_id
     WHERE s.player_id = $1 AND g.kind = 'daily' AND s.finished_at IS NOT NULL`,
    [playerId],
  );
  const { start, end } = weekRange(today);
  return {
    handle: p.handle ?? generateHandle(playerId),
    custom: p.handle_custom,
    showOnLists: p.show_on_lists,
    hidden: p.hidden_by_admin,
    runs: stats?.runs ?? 0,
    best: stats?.best ?? null,
    today: await myRankDaily(db, today, playerId),
    week: await myRankWeekly(db, start, end, playerId),
  };
}

export async function updateProfile(
  db: Db,
  playerId: string,
  patch: { showOnLists?: boolean; customName?: string | null },
): Promise<{ ok: true } | { ok: false; error: UpdateError }> {
  if (!UUID_RE.test(playerId)) return { ok: false, error: "not_found" };
  await ensureHandle(db, playerId);
  if (typeof patch.showOnLists === "boolean") {
    await db.query(`UPDATE players SET show_on_lists = $2 WHERE id = $1`, [playerId, patch.showOnLists]);
  }
  if (patch.customName === null) {
    // Nytt tilfeldig navn.
    await db.query(`UPDATE players SET handle = $2, handle_custom = false WHERE id = $1`, [playerId, generateHandle(`${playerId}:${Date.now()}:${Math.random()}`)]);
  } else if (typeof patch.customName === "string") {
    const v = validateHandle(patch.customName);
    if (!v.ok) return { ok: false, error: v.error };
    const taken = await db.one(`SELECT 1 FROM players WHERE lower(handle) = lower($1) AND handle_custom AND id <> $2`, [v.value, playerId]);
    if (taken) return { ok: false, error: "taken" };
    try {
      await db.query(`UPDATE players SET handle = $2, handle_custom = true WHERE id = $1`, [playerId, v.value]);
    } catch (err) {
      if (/unique|duplicate/i.test((err as Error).message)) return { ok: false, error: "taken" };
      throw err;
    }
  }
  return { ok: true };
}
