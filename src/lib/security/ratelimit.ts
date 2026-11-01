/**
 * Enkel ratebegrensning med faste tidsvinduer lagret i Postgres. Fungerer på serverless
 * (ingen minnetilstand mellom kall). Kan byttes til Redis/Upstash ved stor trafikk.
 */
import type { Db } from "../db/client";

export interface RateLimitResult {
  ok: boolean;
  remaining: number;
  resetSeconds: number;
}

export async function rateLimit(db: Db, key: string, limit: number, windowSeconds: number, now = Date.now()): Promise<RateLimitResult> {
  const windowStart = Math.floor(now / 1000 / windowSeconds) * windowSeconds;
  const row = await db.one<{ count: number }>(
    `INSERT INTO rate_limits (key, window_start, count) VALUES ($1, $2, 1)
     ON CONFLICT (key, window_start) DO UPDATE SET count = rate_limits.count + 1
     RETURNING count`,
    [key, windowStart],
  );
  const count = row?.count ?? 1;
  // Rydd opp gamle vinduer av og til (billig, ~1 % av kallene).
  if (Math.random() < 0.01) {
    await db.query(`DELETE FROM rate_limits WHERE window_start < $1`, [windowStart - 86_400]);
  }
  return {
    ok: count <= limit,
    remaining: Math.max(0, limit - count),
    resetSeconds: windowStart + windowSeconds - Math.floor(now / 1000),
  };
}

export const LIMITS = {
  sessionCreate: { limit: 40, window: 3600 },
  answer: { limit: 400, window: 3600 },
  challengeCreate: { limit: 30, window: 3600 },
  events: { limit: 900, window: 3600 },
  player: { limit: 30, window: 3600 },
  push: { limit: 10, window: 3600 },
  adminLogin: { limit: 8, window: 900 },
  /** Maks antall Nabokrig-tellende runder per IP-hash, kommune og dag. */
  kommunePerIpPerDay: 12,
} as const;
