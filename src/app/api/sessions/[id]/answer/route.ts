import { z } from "zod";
import { NextResponse } from "next/server";
import { guardRate, handleError, playContext, readJson, sameOrigin, jsonError } from "@/lib/http";
import { submitAnswer } from "@/lib/play/service";
import { LIMITS } from "@/lib/security/ratelimit";

export const dynamic = "force-dynamic";

const Body = z.object({
  token: z.string().max(200),
  questionId: z.string().max(100),
  index: z.number().int().min(0).max(50),
  answer: z.unknown(),
});

export async function POST(req: Request, ctxRoute: { params: Promise<{ id: string }> }) {
  if (!sameOrigin(req)) return jsonError(403, "forbidden", "Ugyldig opphav");
  try {
    const { id } = await ctxRoute.params;
    const ctx = await playContext(req);
    const limited = await guardRate(ctx.db, req, "answer", LIMITS.answer.limit, LIMITS.answer.window);
    if (limited) return limited;
    const body = await readJson(req, Body);
    const result = await submitAnswer(ctx, { sessionId: id, ...body });
    return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    return handleError(err);
  }
}
