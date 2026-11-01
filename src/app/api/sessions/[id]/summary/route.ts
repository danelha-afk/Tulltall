import { z } from "zod";
import { NextResponse } from "next/server";
import { handleError, playContext, readJson, sameOrigin, jsonError } from "@/lib/http";
import { sessionSummary } from "@/lib/play/service";
import { getQuestionRows } from "@/lib/db/questions";
import { toReveal } from "@/lib/game/public";

export const dynamic = "force-dynamic";

const Body = z.object({ token: z.string().max(200) });

/** Resultat og fasit for en fullført økt (brukes når spilleren kommer tilbake til en ferdig runde). */
export async function POST(req: Request, ctxRoute: { params: Promise<{ id: string }> }) {
  if (!sameOrigin(req)) return jsonError(403, "forbidden", "Ugyldig opphav");
  try {
    const { id } = await ctxRoute.params;
    const ctx = await playContext(req);
    const body = await readJson(req, Body);
    const result = await sessionSummary(ctx, id, body.token);
    const rows = await getQuestionRows(ctx.db, result.perQuestion.map((p) => p.questionId));
    return NextResponse.json(
      { ...result, reveals: rows.map((r) => ({ prompt: r.content.prompt, ...toReveal(r.content) })) },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (err) {
    return handleError(err);
  }
}
