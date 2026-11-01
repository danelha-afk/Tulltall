import { z } from "zod";
import { NextResponse } from "next/server";
import { guardRate, handleError, playContext, readJson, sameOrigin, jsonError } from "@/lib/http";
import { startSession } from "@/lib/play/service";
import { LIMITS } from "@/lib/security/ratelimit";
import { assignVariants } from "@/lib/analytics/experiments";
import { getSettings } from "@/lib/db/settings";

export const dynamic = "force-dynamic";

const Body = z.object({
  playerId: z.string().max(64).nullish(),
  gameId: z.string().max(100).optional(),
  challengeCode: z.string().regex(/^[a-z0-9]{6,12}$/).optional(),
  kommuneNr: z.string().regex(/^\d{4}$/).nullish(),
  ref: z.string().max(80).nullish(),
  nickname: z.string().max(40).nullish(),
});

export async function POST(req: Request) {
  if (!sameOrigin(req)) return jsonError(403, "forbidden", "Ugyldig opphav");
  try {
    const ctx = await playContext(req);
    const limited = await guardRate(ctx.db, req, "session", LIMITS.sessionCreate.limit, LIMITS.sessionCreate.window);
    if (limited) return limited;
    const body = await readJson(req, Body);
    const settings = await getSettings(ctx.db);
    const result = await startSession(ctx, {
      ...body,
      variants: body.playerId ? assignVariants(body.playerId, settings.experiments) : {},
    });
    const variants = assignVariants(result.playerId, settings.experiments);
    return NextResponse.json({ ...result, variants }, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    return handleError(err);
  }
}
