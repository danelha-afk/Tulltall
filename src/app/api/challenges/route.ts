import { z } from "zod";
import { NextResponse } from "next/server";
import { guardRate, handleError, playContext, readJson, sameOrigin, jsonError } from "@/lib/http";
import { createChallenge } from "@/lib/play/service";
import { LIMITS } from "@/lib/security/ratelimit";

export const dynamic = "force-dynamic";

const Body = z.object({
  sessionId: z.string().uuid(),
  token: z.string().max(200),
  nickname: z.string().max(40).nullish(),
});

export async function POST(req: Request) {
  if (!sameOrigin(req)) return jsonError(403, "forbidden", "Ugyldig opphav");
  try {
    const ctx = await playContext(req);
    const limited = await guardRate(ctx.db, req, "challenge", LIMITS.challengeCreate.limit, LIMITS.challengeCreate.window);
    if (limited) return limited;
    const body = await readJson(req, Body);
    const result = await createChallenge(ctx, body);
    return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    return handleError(err);
  }
}
