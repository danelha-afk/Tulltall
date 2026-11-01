import { z } from "zod";
import { NextResponse } from "next/server";
import { getDb } from "@/lib/db/client";
import { EventSchema, recordEvents } from "@/lib/analytics/events";
import { BOT_UA, guardRate, handleError, readJson, sameOrigin, jsonError } from "@/lib/http";
import { LIMITS } from "@/lib/security/ratelimit";
import { UUID_RE } from "@/lib/security/crypto";

export const dynamic = "force-dynamic";

const Body = z.object({
  events: z.array(EventSchema).min(1).max(30),
  /** Sendes bare når brukeren har samtykket til statistikk. */
  playerId: z.string().max(64).nullish(),
});

export async function POST(req: Request) {
  if (!sameOrigin(req)) return jsonError(403, "forbidden", "Ugyldig opphav");
  if (BOT_UA.test(req.headers.get("user-agent") ?? "")) return NextResponse.json({ ok: true, stored: 0 });
  try {
    const db = await getDb();
    const limited = await guardRate(db, req, "events", LIMITS.events.limit, LIMITS.events.window);
    if (limited) return limited;
    const body = await readJson(req, Body, 32_768);
    const playerId = body.playerId && UUID_RE.test(body.playerId) ? body.playerId : null;
    const stored = await recordEvents(db, body.events, playerId);
    return NextResponse.json({ ok: true, stored });
  } catch (err) {
    return handleError(err);
  }
}
