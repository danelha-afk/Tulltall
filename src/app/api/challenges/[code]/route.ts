import { NextResponse } from "next/server";
import { getDb } from "@/lib/db/client";
import { getChallengeView } from "@/lib/play/service";
import { handleError, jsonError } from "@/lib/http";

export const dynamic = "force-dynamic";

export async function GET(req: Request, ctxRoute: { params: Promise<{ code: string }> }) {
  try {
    const { code } = await ctxRoute.params;
    const viewer = new URL(req.url).searchParams.get("session");
    const view = await getChallengeView(await getDb(), code, viewer);
    if (!view) return jsonError(404, "not_found", "Fant ikke utfordringen");
    return NextResponse.json(view, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    return handleError(err);
  }
}
