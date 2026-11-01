/**
 * Spilltjenesten: start, svar, avslutt og utfordringer. Serveren er autoritativ:
 * klienten ser aldri fasit før svaret er levert, og poeng beregnes kun her.
 */
import type { Db } from "../db/client";
import { getGame, publishDailyGame, servedQuestions, ensureSingleGame, type GameRow } from "../db/games";
import { getQuestionRows } from "../db/questions";
import { toPublic, toReveal, type PublicQuestion, type RevealData } from "../game/public";
import { AnswerSchema, scoreAnswer, summarize, type RoundSummary } from "../game/scoring";
import { localDate, roundNumber } from "../game/dates";
import { hmac, newId, safeEqual, shortCode, UUID_RE } from "../security/crypto";
import { generateHandle, isAcceptableNickname } from "../profile/names";
import { LIMITS } from "../security/ratelimit";
import { brand } from "../config/brand";

export class PlayError extends Error {
  constructor(
    public code:
      | "not_found"
      | "forbidden"
      | "bad_request"
      | "too_fast"
      | "out_of_order"
      | "finished"
      | "not_finished"
      | "unavailable",
    message: string,
  ) {
    super(message);
  }
}

export interface PlayContext {
  db: Db;
  secret: string;
  minAnswerMs: number;
  comparisonMinPlayers: number;
  now?: () => Date;
  ipHash?: string | null;
}

interface SessionRow {
  id: string;
  game_id: string;
  player_id: string;
  challenge_code: string | null;
  kommune_nr: string | null;
  question_ids: string[];
  answers: StoredAnswer[];
  next_index: number;
  last_served_at: Date;
  started_at: Date;
  finished_at: Date | null;
  score: number | null;
  hits: number | null;
  max_score: number | null;
  counted_for_kommune: boolean;
  ip_hash: string | null;
  ref: string | null;
  nickname: string | null;
}

export interface StoredAnswer {
  questionId: string;
  format: string;
  answer: unknown;
  points: number;
  hit: boolean;
  retracted?: boolean;
  at: string;
}

export interface GameInfo {
  id: string;
  kind: GameRow["kind"];
  date: string | null;
  roundNumber: number | null;
}

export interface StartResult {
  sessionId: string;
  token: string;
  playerId: string;
  game: GameInfo;
  questions: PublicQuestion[];
  answers: { questionId: string; points: number; hit: boolean }[];
  finished: boolean;
  kommuneNr: string | null;
}

const now = (ctx: PlayContext) => (ctx.now ? ctx.now() : new Date());

export function sessionToken(secret: string, sessionId: string, playerId: string): string {
  return hmac(secret, `session:${sessionId}:${playerId}`);
}

export function sanitizeNickname(input: unknown): string | null {
  if (typeof input !== "string") return null;
  const cleaned = input
    .normalize("NFC")
    .replace(/[^\p{L}\p{N} .\-_']/gu, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 24);
  if (cleaned.length < 1) return null;
  // Navn som vises for andre (utfordringer) må passere samme filter som spillernavn.
  return cleaned.length >= 3 && !isAcceptableNickname(cleaned) ? null : cleaned;
}

function gameInfo(game: GameRow): GameInfo {
  return {
    id: game.id,
    kind: game.kind,
    date: game.game_date,
    roundNumber: game.kind === "daily" && game.game_date ? roundNumber(game.game_date, brand.launchDate) : null,
  };
}

export async function ensurePlayer(db: Db, playerId: string | null | undefined): Promise<string> {
  if (playerId && UUID_RE.test(playerId)) {
    const row = await db.one<{ id: string }>(`UPDATE players SET last_seen_at = now() WHERE id = $1 RETURNING id`, [playerId]);
    if (row) return row.id;
    // Ukjent, men gyldig id (f.eks. etter databasetilbakestilling): opprett med samme id.
    await db.query(`INSERT INTO players (id, handle) VALUES ($1, $2) ON CONFLICT (id) DO NOTHING`, [playerId, generateHandle(playerId)]);
    return playerId;
  }
  const id = newId();
  await db.query(`INSERT INTO players (id, handle) VALUES ($1, $2)`, [id, generateHandle(id)]);
  return id;
}

async function resolveGame(ctx: PlayContext, opts: { gameId?: string; challengeCode?: string }): Promise<GameRow> {
  const today = localDate(now(ctx));
  if (opts.challengeCode) {
    const ch = await ctx.db.one<{ game_id: string }>(`SELECT game_id FROM challenges WHERE code = $1`, [opts.challengeCode]);
    if (!ch) throw new PlayError("not_found", "Fant ikke utfordringen");
    const g = await getGame(ctx.db, ch.game_id);
    if (!g) throw new PlayError("not_found", "Fant ikke runden");
    return g;
  }
  if (opts.gameId) {
    const m = /^d-(\d{4}-\d{2}-\d{2})$/.exec(opts.gameId);
    if (m) {
      if (m[1] > today) throw new PlayError("forbidden", "Denne runden er ikke publisert ennå");
      const g = m[1] === today ? await publishDailyGame(ctx.db, today) : await getGame(ctx.db, opts.gameId);
      if (!g || g.status === "scheduled") throw new PlayError("not_found", "Fant ikke runden");
      return g;
    }
    const s = /^q-([a-z0-9][a-z0-9-]{2,80})$/.exec(opts.gameId);
    if (s) {
      const g = await ensureSingleGame(ctx.db, s[1]);
      if (!g) throw new PlayError("not_found", "Fant ikke spørsmålet");
      return g;
    }
    throw new PlayError("bad_request", "Ugyldig runde");
  }
  const g = await publishDailyGame(ctx.db, today);
  if (!g) throw new PlayError("unavailable", "Dagens runde er ikke klar");
  return g;
}

export async function startSession(
  ctx: PlayContext,
  opts: {
    playerId?: string | null;
    gameId?: string;
    challengeCode?: string;
    kommuneNr?: string | null;
    ref?: string | null;
    nickname?: string | null;
    variants?: Record<string, string>;
  },
): Promise<StartResult> {
  const { db } = ctx;
  const playerId = await ensurePlayer(db, opts.playerId);
  const game = await resolveGame(ctx, opts);

  // Gjenoppta eksisterende økt for samme spiller og runde (ingen omspill av samme runde).
  const existing = await db.one<SessionRow>(
    `SELECT * FROM sessions WHERE player_id = $1 AND game_id = $2 ORDER BY started_at DESC LIMIT 1`,
    [playerId, game.id],
  );
  const kommuneNr = opts.kommuneNr && /^\d{4}$/.test(opts.kommuneNr) ? opts.kommuneNr : null;
  if (kommuneNr) {
    const k = await db.one(`SELECT nr FROM kommuner WHERE nr = $1`, [kommuneNr]);
    if (!k) throw new PlayError("bad_request", "Ukjent kommune");
  }

  let session: SessionRow;
  if (existing) {
    session = existing;
    if (!existing.finished_at && opts.challengeCode && !existing.challenge_code) {
      await db.query(`UPDATE sessions SET challenge_code = $2 WHERE id = $1`, [existing.id, opts.challengeCode]);
      session = { ...existing, challenge_code: opts.challengeCode };
    }
  } else {
    const rows = await servedQuestions(db, game);
    if (rows.length === 0) throw new PlayError("unavailable", "Runden har ingen aktive spørsmål");
    const id = newId();
    const inserted = await db.one<SessionRow>(
      `INSERT INTO sessions (id, game_id, player_id, challenge_code, kommune_nr, question_ids, ip_hash, ref, variants, nickname, last_served_at)
       VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7,$8,$9::jsonb,$10,$11) RETURNING *`,
      [
        id,
        game.id,
        playerId,
        opts.challengeCode ?? null,
        kommuneNr,
        JSON.stringify(rows.map((r) => r.id)),
        ctx.ipHash ?? null,
        opts.ref?.slice(0, 80) ?? null,
        JSON.stringify(opts.variants ?? {}),
        sanitizeNickname(opts.nickname),
        now(ctx),
      ],
    );
    session = inserted!;
  }

  const rows = await getQuestionRows(db, session.question_ids);
  const questions = rows.map((r) => toPublic(r.content, game.seed));
  return {
    sessionId: session.id,
    token: sessionToken(ctx.secret, session.id, playerId),
    playerId,
    game: gameInfo(game),
    questions,
    answers: session.answers.map((a) => ({ questionId: a.questionId, points: a.points, hit: a.hit })),
    finished: Boolean(session.finished_at),
    kommuneNr: session.kommune_nr,
  };
}

async function loadSession(ctx: PlayContext, sessionId: string, token: string, forUpdate = false): Promise<SessionRow> {
  if (!UUID_RE.test(sessionId)) throw new PlayError("not_found", "Ukjent økt");
  const s = await ctx.db.one<SessionRow>(`SELECT * FROM sessions WHERE id = $1 ${forUpdate ? "FOR UPDATE" : ""}`, [sessionId]);
  if (!s) throw new PlayError("not_found", "Ukjent økt");
  if (!safeEqual(sessionToken(ctx.secret, s.id, s.player_id), String(token ?? ""))) {
    throw new PlayError("forbidden", "Ugyldig økt-token");
  }
  return s;
}

export interface AnswerResult {
  index: number;
  points: number;
  hit: boolean;
  retracted: boolean;
  detail: Record<string, unknown>;
  reveal: RevealData;
  done: boolean;
}

export async function submitAnswer(
  ctx: PlayContext,
  opts: { sessionId: string; token: string; questionId: string; index: number; answer: unknown },
): Promise<AnswerResult> {
  return ctx.db.tx(async (db) => {
    const inner = { ...ctx, db };
    const s = await loadSession(inner, opts.sessionId, opts.token, true);
    if (s.finished_at) throw new PlayError("finished", "Runden er allerede fullført");
    if (opts.index !== s.next_index || s.question_ids[opts.index] !== opts.questionId) {
      throw new PlayError("out_of_order", "Svaret kom i feil rekkefølge");
    }
    const elapsed = now(ctx).getTime() - new Date(s.last_served_at).getTime();
    if (elapsed < ctx.minAnswerMs) throw new PlayError("too_fast", "Svaret kom for raskt");

    const [row] = await getQuestionRows(db, [opts.questionId]);
    if (!row) throw new PlayError("not_found", "Fant ikke spørsmålet");
    const retracted = row.status === "archived";

    let points = 0;
    let hit = false;
    let detail: Record<string, unknown> = {};
    if (!retracted) {
      const parsed = AnswerSchema.safeParse(opts.answer);
      if (!parsed.success) throw new PlayError("bad_request", "Ugyldig svar");
      try {
        const scored = scoreAnswer(row.content.payload, parsed.data);
        points = scored.points;
        hit = scored.hit;
        detail = scored.detail;
      } catch (err) {
        throw new PlayError("bad_request", (err as Error).message);
      }
    }
    const stored: StoredAnswer = {
      questionId: row.id,
      format: row.content.payload.format,
      answer: opts.answer,
      points,
      hit,
      retracted: retracted || undefined,
      at: now(ctx).toISOString(),
    };
    await db.query(
      `UPDATE sessions SET answers = answers || $2::jsonb, next_index = next_index + 1, last_served_at = $3 WHERE id = $1`,
      [s.id, JSON.stringify([stored]), now(ctx)],
    );
    return {
      index: opts.index,
      points,
      hit,
      retracted,
      detail,
      reveal: toReveal(row.content),
      done: opts.index + 1 >= s.question_ids.length,
    };
  });
}

export interface FinishResult {
  summary: RoundSummary;
  titleKey: string;
  perQuestion: { questionId: string; points: number; hit: boolean; retracted: boolean }[];
  comparison: { n: number; beatenPercent: number | null };
  kommune: { nr: string; name: string; counted: boolean } | null;
  challenge: ChallengeView | null;
  game: GameInfo;
}

/** Tittelnøkkel (0–10) skalert til antall spørsmål. */
export function titleKeyFor(hits: number, total: number): string {
  if (total <= 0) return "0";
  return String(Math.max(0, Math.min(10, Math.round((hits / total) * 10))));
}

export async function finishSession(ctx: PlayContext, opts: { sessionId: string; token: string }): Promise<FinishResult> {
  const { db } = ctx;
  const result = await db.tx(async (tx) => {
    const s = await loadSession({ ...ctx, db: tx }, opts.sessionId, opts.token, true);
    if (s.answers.length < s.question_ids.length) throw new PlayError("not_finished", "Runden er ikke ferdig");
    const scoredAnswers = s.answers.filter((a) => !a.retracted);
    const summary = summarize(scoredAnswers.map((a) => ({ format: a.format, points: a.points, hit: a.hit })));
    if (!s.finished_at) {
      const game = (await getGame(tx, s.game_id))!;
      let counted = false;
      if (s.kommune_nr && game.kind === "daily" && game.game_date === localDate(now(ctx))) {
        const already = await tx.one<{ n: number }>(
          `SELECT count(*)::int AS n FROM sessions WHERE player_id = $1 AND counted_for_kommune
             AND game_id = $2 AND id <> $3`,
          [s.player_id, s.game_id, s.id],
        );
        const perIp = s.ip_hash
          ? await tx.one<{ n: number }>(
              `SELECT count(*)::int AS n FROM sessions WHERE ip_hash = $1 AND kommune_nr = $2 AND counted_for_kommune AND game_id = $3`,
              [s.ip_hash, s.kommune_nr, s.game_id],
            )
          : { n: 0 };
        counted = (already?.n ?? 0) === 0 && (perIp?.n ?? 0) < LIMITS.kommunePerIpPerDay;
      }
      await tx.query(
        `UPDATE sessions SET finished_at = $2, score = $3, hits = $4, max_score = $5, counted_for_kommune = $6 WHERE id = $1`,
        [s.id, now(ctx), summary.score, summary.hits, summary.maxScore, counted],
      );
      return { s: { ...s, counted_for_kommune: counted, finished_at: now(ctx) }, summary, game };
    }
    return { s, summary, game: (await getGame(tx, s.game_id))! };
  });

  const { s, summary, game } = result;
  const stats = await db.one<{ n: number; below: number }>(
    `SELECT count(*)::int AS n, count(*) FILTER (WHERE score < $2)::int AS below
     FROM sessions WHERE game_id = $1 AND finished_at IS NOT NULL`,
    [s.game_id, summary.score],
  );
  const n = stats?.n ?? 0;
  const comparison = {
    n,
    beatenPercent: n >= ctx.comparisonMinPlayers ? Math.round(((stats?.below ?? 0) / n) * 100) : null,
  };
  let kommune: FinishResult["kommune"] = null;
  if (s.kommune_nr) {
    const k = await db.one<{ nr: string; name: string }>(`SELECT nr, name FROM kommuner WHERE nr = $1`, [s.kommune_nr]);
    if (k) kommune = { nr: k.nr, name: k.name, counted: s.counted_for_kommune };
  }
  const challenge = s.challenge_code ? await getChallengeView(db, s.challenge_code, s.id) : null;
  return {
    summary,
    titleKey: titleKeyFor(summary.hits, summary.total),
    perQuestion: s.answers.map((a) => ({ questionId: a.questionId, points: a.points, hit: a.hit, retracted: Boolean(a.retracted) })),
    comparison,
    kommune,
    challenge,
    game: gameInfo(game),
  };
}

export interface ChallengeView {
  code: string;
  gameId: string;
  game: GameInfo;
  creator: { nickname: string | null; hits: number; score: number; total: number };
  leaderboard: { nickname: string | null; hits: number; score: number; isCreator: boolean; isYou: boolean }[];
  /** Per-spørsmål treff – bare når betrakteren selv har fullført. */
  headToHead: { creator: boolean[]; you: boolean[] } | null;
}

export async function createChallenge(
  ctx: PlayContext,
  opts: { sessionId: string; token: string; nickname?: string | null; kind?: "friend" | "kommune" },
): Promise<{ code: string; url: string }> {
  const { db } = ctx;
  const s = await loadSession(ctx, opts.sessionId, opts.token);
  if (!s.finished_at) throw new PlayError("not_finished", "Fullfør runden før du utfordrer noen");
  const existing = await db.one<{ code: string }>(`SELECT code FROM challenges WHERE creator_session_id = $1`, [s.id]);
  const nickname = sanitizeNickname(opts.nickname);
  if (existing) {
    if (nickname) await db.query(`UPDATE challenges SET creator_nickname = $2 WHERE code = $1`, [existing.code, nickname]);
    return { code: existing.code, url: `${brand.url}/u/${existing.code}` };
  }
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = shortCode(8);
    const row = await db.one<{ code: string }>(
      `INSERT INTO challenges (code, game_id, creator_session_id, creator_player_id, creator_nickname, kind, kommune_nr)
       VALUES ($1,$2,$3,$4,$5,$6,$7) ON CONFLICT (code) DO NOTHING RETURNING code`,
      [code, s.game_id, s.id, s.player_id, nickname, opts.kind ?? "friend", s.kommune_nr],
    );
    if (row) {
      if (nickname) await db.query(`UPDATE sessions SET nickname = $2 WHERE id = $1`, [s.id, nickname]);
      return { code: row.code, url: `${brand.url}/u/${row.code}` };
    }
  }
  throw new Error("Kunne ikke lage unik kode");
}

export async function getChallengeView(db: Db, code: string, viewerSessionId?: string | null): Promise<ChallengeView | null> {
  if (!/^[a-z0-9]{6,12}$/.test(code)) return null;
  const ch = await db.one<{ code: string; game_id: string; creator_session_id: string; creator_nickname: string | null }>(
    `SELECT code, game_id, creator_session_id, creator_nickname FROM challenges WHERE code = $1`,
    [code],
  );
  if (!ch) return null;
  const game = await getGame(db, ch.game_id);
  if (!game) return null;
  const creator = await db.one<SessionRow>(`SELECT * FROM sessions WHERE id = $1`, [ch.creator_session_id]);
  if (!creator) return null;
  const rows = await db.query<{ id: string; nickname: string | null; hits: number; score: number }>(
    `SELECT id, nickname, hits, score FROM sessions
     WHERE (challenge_code = $1 OR id = $2) AND finished_at IS NOT NULL
     ORDER BY score DESC, finished_at ASC LIMIT 25`,
    [code, ch.creator_session_id],
  );
  let headToHead: ChallengeView["headToHead"] = null;
  if (viewerSessionId && UUID_RE.test(viewerSessionId) && viewerSessionId !== creator.id) {
    const viewer = await db.one<SessionRow>(`SELECT * FROM sessions WHERE id = $1 AND game_id = $2`, [viewerSessionId, ch.game_id]);
    if (viewer?.finished_at) {
      headToHead = {
        creator: creator.answers.map((a) => a.hit),
        you: viewer.answers.map((a) => a.hit),
      };
    }
  }
  return {
    code: ch.code,
    gameId: ch.game_id,
    game: gameInfo(game),
    creator: {
      nickname: ch.creator_nickname,
      hits: creator.hits ?? 0,
      score: creator.score ?? 0,
      total: creator.question_ids.length,
    },
    leaderboard: rows.map((r) => ({
      nickname: r.id === creator.id ? ch.creator_nickname : r.nickname,
      hits: r.hits,
      score: r.score,
      isCreator: r.id === creator.id,
      isYou: r.id === viewerSessionId,
    })),
    headToHead,
  };
}

/** Oppsummering for allerede fullførte økter (f.eks. når spilleren åpner forsiden igjen). */
export async function sessionSummary(ctx: PlayContext, sessionId: string, token: string): Promise<FinishResult> {
  const s = await loadSession(ctx, sessionId, token);
  if (!s.finished_at) throw new PlayError("not_finished", "Runden er ikke ferdig");
  return finishSession(ctx, { sessionId, token });
}
