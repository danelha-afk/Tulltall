import { z } from "zod";
import { NextResponse } from "next/server";
import { getDb } from "@/lib/db/client";
import { guardRate, handleError, readJson, sameOrigin, jsonError } from "@/lib/http";
import { LIMITS } from "@/lib/security/ratelimit";
import { UUID_RE } from "@/lib/security/crypto";

export const dynamic = "force-dynamic";

const Sub = z.object({
  endpoint: z.string().url().max(800).refine((u) => u.startsWith("https://"), "https kreves"),
  keys: z.object({ p256dh: z.string().max(200), auth: z.string().max(100) }),
});

export async function POST(req: Request) {
  if (!sameOrigin(req)) return jsonError(403, "forbidden", "Ugyldig opphav");
  try {
    const db = await getDb();
    const limited = await guardRate(db, req, "push", LIMITS.push.limit, LIMITS.push.window);
    if (limited) return limited;
    const body = await readJson(req, z.object({ subscription: Sub, playerId: z.string().max(64).nullish() }));
    const pid = body.playerId && UUID_RE.test(body.playerId) ? body.playerId : null;
    await db.query(
      `INSERT INTO push_subscriptions (endpoint, player_id, keys) VALUES ($1, $2, $3::jsonb)
       ON CONFLICT (endpoint) DO UPDATE SET keys = EXCLUDED.keys, failures = 0`,
      [body.subscription.endpoint, pid, JSON.stringify(body.subscription.keys)],
    );
    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleError(err);
  }
}

export async function DELETE(req: Request) {
  if (!sameOrigin(req)) return jsonError(403, "forbidden", "Ugyldig opphav");
  try {
    const db = await getDb();
    const body = await readJson(req, z.object({ endpoint: z.string().url().max(800) }));
    await db.query(`DELETE FROM push_subscriptions WHERE endpoint = $1`, [body.endpoint]);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleError(err);
  }
}
