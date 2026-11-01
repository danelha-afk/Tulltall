/**
 * Analysepanelets spørringer. Alt er aggregert; ingen enkeltspillere vises.
 * Gjenbesøk måles bare for spillere som har samtykket til statistikk.
 */
import type { Db } from "../db/client";

export interface Funnel {
  days: number;
  pageViews: number;
  sessionsStarted: number;
  sessionsFinished: number;
  completionRate: number | null;
  avgMinutes: number | null;
  shareClicks: number;
  shareSuccess: number;
  challengesCreated: number;
  challengeOpens: number;
  challengeSessions: number;
  singleOpens: number;
  newPlayersFromShares: number;
  pushOptins: number;
  installs: number;
}

export async function funnel(db: Db, days: number): Promise<Funnel> {
  const since = `now() - interval '${Math.max(1, Math.min(365, Math.floor(days)))} days'`;
  const ev = await db.query<{ name: string; n: number }>(`SELECT name, count(*)::int AS n FROM events WHERE ts >= ${since} GROUP BY name`);
  const e = (n: string) => ev.find((x) => x.name === n)?.n ?? 0;
  const s = await db.one<{ started: number; finished: number; avg_min: number | null; ch: number }>(
    `SELECT count(*)::int AS started, count(finished_at)::int AS finished,
            avg(EXTRACT(EPOCH FROM (finished_at - started_at)) / 60) FILTER (WHERE finished_at IS NOT NULL AND finished_at - started_at < interval '2 hours')::float AS avg_min,
            count(*) FILTER (WHERE challenge_code IS NOT NULL)::int AS ch
     FROM sessions WHERE started_at >= ${since}`,
  );
  const fromShares = await db.one<{ n: number }>(
    `SELECT count(DISTINCT s.player_id)::int AS n FROM sessions s JOIN players p ON p.id = s.player_id
     WHERE s.started_at >= ${since} AND (s.ref LIKE 'ch:%' OR s.ref LIKE 'q:%' OR s.ref LIKE 'nk:%' OR s.challenge_code IS NOT NULL)
       AND p.created_at >= s.started_at - interval '10 minutes'`,
  );
  const chCreated = await db.one<{ n: number }>(`SELECT count(*)::int AS n FROM challenges WHERE created_at >= ${since}`);
  return {
    days,
    pageViews: e("page_view"),
    sessionsStarted: s?.started ?? 0,
    sessionsFinished: s?.finished ?? 0,
    completionRate: s && s.started ? Math.round((s.finished / s.started) * 1000) / 10 : null,
    avgMinutes: s?.avg_min ? Math.round(s.avg_min * 10) / 10 : null,
    shareClicks: e("share_click"),
    shareSuccess: e("share_success"),
    challengesCreated: chCreated?.n ?? 0,
    challengeOpens: e("challenge_open"),
    challengeSessions: s?.ch ?? 0,
    singleOpens: e("single_open"),
    newPlayersFromShares: fromShares?.n ?? 0,
    pushOptins: e("push_optin"),
    installs: e("install_accepted"),
  };
}

export async function dailySeries(db: Db, days = 14) {
  return db.query<{ day: string; started: number; finished: number; views: number }>(
    `WITH d AS (SELECT generate_series(current_date - ($1::int - 1), current_date, interval '1 day')::date AS day)
     SELECT to_char(d.day, 'YYYY-MM-DD') AS day,
       (SELECT count(*)::int FROM sessions s WHERE s.started_at::date = d.day) AS started,
       (SELECT count(*)::int FROM sessions s WHERE s.finished_at::date = d.day) AS finished,
       (SELECT count(*)::int FROM events e WHERE e.name = 'page_view' AND e.ts::date = d.day) AS views
     FROM d ORDER BY d.day`,
    [days],
  );
}

/** Gjenbesøk (D1/D7) blant spillere som har samtykket til statistikk. */
export async function retention(db: Db) {
  const row = await db.one<{ cohort: number; d1: number; d7: number }>(
    `WITH firsts AS (
       SELECT player_id, min(ts)::date AS first_day FROM events WHERE player_id IS NOT NULL GROUP BY player_id
     ), cohort AS (SELECT * FROM firsts WHERE first_day BETWEEN current_date - 37 AND current_date - 8)
     SELECT count(*)::int AS cohort,
       count(*) FILTER (WHERE EXISTS (SELECT 1 FROM events e WHERE e.player_id = c.player_id AND e.ts::date = c.first_day + 1))::int AS d1,
       count(*) FILTER (WHERE EXISTS (SELECT 1 FROM events e WHERE e.player_id = c.player_id AND e.ts::date BETWEEN c.first_day + 1 AND c.first_day + 7))::int AS d7
     FROM cohort c`,
  );
  return {
    cohort: row?.cohort ?? 0,
    d1: row && row.cohort ? Math.round((row.d1 / row.cohort) * 1000) / 10 : null,
    d7: row && row.cohort ? Math.round((row.d7 / row.cohort) * 1000) / 10 : null,
  };
}

export interface QuestionPerf {
  id: string;
  prompt: string;
  format: string;
  category: string;
  answers: number;
  avgPoints: number;
  hitRate: number;
  abandons: number;
  shares: number;
}

export async function questionPerformance(db: Db, days = 30): Promise<QuestionPerf[]> {
  return db.query<QuestionPerf>(
    `WITH a AS (
       SELECT x->>'questionId' AS qid, (x->>'points')::int AS points, (x->>'hit')::boolean AS hit
       FROM sessions s, jsonb_array_elements(s.answers) x WHERE s.started_at >= now() - ($1::int * interval '1 day')
     ), ab AS (
       SELECT s.question_ids->>s.next_index AS qid, count(*)::int AS n FROM sessions s
       WHERE s.finished_at IS NULL AND s.started_at < now() - interval '1 hour' AND s.started_at >= now() - ($1::int * interval '1 day')
         AND s.next_index < jsonb_array_length(s.question_ids)
       GROUP BY 1
     ), sh AS (
       SELECT props->>'q' AS qid, count(*)::int AS n FROM events WHERE name = 'share_click' AND props->>'kind' = 'question'
         AND ts >= now() - ($1::int * interval '1 day') GROUP BY 1
     )
     SELECT q.id, q.content->>'prompt' AS prompt, q.format, q.category,
       count(a.qid)::int AS answers, COALESCE(round(avg(a.points)), 0)::int AS "avgPoints",
       COALESCE(round(100.0 * avg(CASE WHEN a.hit THEN 1 ELSE 0 END)), 0)::int AS "hitRate",
       COALESCE(max(ab.n), 0)::int AS abandons, COALESCE(max(sh.n), 0)::int AS shares
     FROM questions q LEFT JOIN a ON a.qid = q.id LEFT JOIN ab ON ab.qid = q.id LEFT JOIN sh ON sh.qid = q.id
     GROUP BY q.id HAVING count(a.qid) > 0 ORDER BY answers DESC LIMIT 200`,
    [days],
  );
}

export async function formatPerformance(db: Db, days = 30) {
  return db.query<{ format: string; answers: number; avg_points: number; hit_rate: number }>(
    `SELECT x->>'format' AS format, count(*)::int AS answers, round(avg((x->>'points')::int))::int AS avg_points,
       round(100.0 * avg(CASE WHEN (x->>'hit')::boolean THEN 1 ELSE 0 END))::int AS hit_rate
     FROM sessions s, jsonb_array_elements(s.answers) x WHERE s.started_at >= now() - ($1::int * interval '1 day')
     GROUP BY 1 ORDER BY answers DESC`,
    [days],
  );
}

export async function topicPerformance(db: Db, days = 30) {
  return db.query<{ topic: string; answers: number; avg_points: number }>(
    `SELECT q.topic, count(*)::int AS answers, round(avg((x->>'points')::int))::int AS avg_points
     FROM sessions s, jsonb_array_elements(s.answers) x JOIN questions q ON q.id = x->>'questionId'
     WHERE s.started_at >= now() - ($1::int * interval '1 day') GROUP BY 1 ORDER BY answers DESC LIMIT 30`,
    [days],
  );
}

/** A/B-resultater per variant: fullføring og deling. */
export async function experimentResults(db: Db, key: string, days = 30) {
  return db.query<{ variant: string; sessions: number; finished: number; shares: number }>(
    `WITH sv AS (
       SELECT variants->>$1 AS variant, finished_at FROM sessions
       WHERE variants ? $1 AND started_at >= now() - ($2::int * interval '1 day')
     ), sh AS (
       SELECT variants->>$1 AS variant, count(*)::int AS n FROM events
       WHERE name = 'share_click' AND variants ? $1 AND ts >= now() - ($2::int * interval '1 day') GROUP BY 1
     )
     SELECT sv.variant, count(*)::int AS sessions, count(sv.finished_at)::int AS finished, COALESCE(max(sh.n), 0)::int AS shares
     FROM sv LEFT JOIN sh ON sh.variant = sv.variant GROUP BY sv.variant ORDER BY sv.variant`,
    [key, days],
  );
}

export async function revenueAndCosts(db: Db) {
  return db.query<{ month: string; ad_revenue_nok: number; other_revenue_nok: number; hosting_cost_nok: number; page_views: number; ai_cost_usd: number }>(
    `WITH m AS (SELECT to_char(date_trunc('month', now()) - (g * interval '1 month'), 'YYYY-MM') AS month FROM generate_series(0, 5) g)
     SELECT m.month,
       COALESCE(r.ad_revenue_nok, 0)::float AS ad_revenue_nok, COALESCE(r.other_revenue_nok, 0)::float AS other_revenue_nok,
       COALESCE(r.hosting_cost_nok, 0)::float AS hosting_cost_nok,
       (SELECT count(*)::int FROM events e WHERE e.name = 'page_view' AND to_char(e.ts, 'YYYY-MM') = m.month) AS page_views,
       (SELECT COALESCE(sum(cost_usd), 0)::float FROM ai_usage a WHERE to_char(a.created_at, 'YYYY-MM') = m.month) AS ai_cost_usd
     FROM m LEFT JOIN revenue_entries r ON r.month = m.month ORDER BY m.month DESC`,
  );
}

/**
 * Kalibrering: blander redaksjonens anslag (prior) med faktisk atferd når et spørsmål har nok data.
 * Atferdsmål = 0,5 × (1 − avbruddsrate) + 0,5 × delingsrate (normalisert). Små utvalg endrer lite.
 */
export async function recalibratePriorities(db: Db, minAnswers = 50): Promise<number> {
  const perf = await questionPerformance(db, 60);
  let n = 0;
  for (const p of perf) {
    if (p.answers < minAnswers) continue;
    const row = await db.one<{ scores: { priority?: number; prior?: number } }>(`SELECT scores FROM questions WHERE id = $1`, [p.id]);
    if (!row) continue;
    const prior = row.scores.prior ?? row.scores.priority ?? 0.5;
    const abandonRate = Math.min(1, p.abandons / Math.max(1, p.answers));
    const shareRate = Math.min(1, (p.shares / p.answers) * 20);
    const observed = 0.5 * (1 - abandonRate) + 0.5 * shareRate;
    const w = p.answers / (p.answers + 200);
    const priority = Math.round(((1 - w) * prior + w * observed) * 100) / 100;
    await db.query(`UPDATE questions SET scores = scores || $2::jsonb WHERE id = $1`, [p.id, JSON.stringify({ prior, priority, observed: Math.round(observed * 100) / 100 })]);
    n++;
  }
  return n;
}
