import { z } from "zod";
import { NextResponse } from "next/server";
import { handleError, playContext, readJson, sameOrigin, jsonError } from "@/lib/http";
import { finishSession } from "@/lib/play/service";

export const dynamic = "force-dynamic";

const Body = z.object({ token: z.string().max(200) });

export async function POST(req: Request, ctxRoute: { params: Promise<{ id: string }> }) {
  if (!sameOrigin(req)) return jsonError(403, "forbidden", "Ugyldig opphav");
  try {
    const { id } = await ctxRoute.params;
    const ctx = await playContext(req);
    const body = await readJson(req, Body);
    const result = await finishSession(ctx, { sessionId: id, token: body.token });
    return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    return handleError(err);
  }
}
