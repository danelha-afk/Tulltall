import { z } from "zod";
import { NextResponse } from "next/server";
import { getDb } from "@/lib/db/client";
import { guardRate, handleError, jsonError, readJson, sameOrigin } from "@/lib/http";
import { getProfile } from "@/lib/profile/service";
import { restoreByCode } from "@/lib/profile/recovery";
import { localDate } from "@/lib/game/dates";

export const dynamic = "force-dynamic";

const Body = z.object({ code: z.string().min(8).max(40) });

/** Bytt til en eksisterende profil med gjenopprettingskoden. Streng ratebegrensning mot gjetting. */
export async function POST(req: Request) {
  if (!sameOrigin(req)) return jsonError(403, "forbidden", "Ugyldig opphav");
  try {
    const db = await getDb();
    const limited = await guardRate(db, req, "restore", 20, 3600);
    if (limited) return limited;
    const { code } = await readJson(req, Body);
    const playerId = await restoreByCode(db, code);
    if (!playerId) return jsonError(404, "not_found", "Fant ingen profil med den koden");
    const profile = await getProfile(db, playerId, localDate());
    return NextResponse.json({ playerId, profile }, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    return handleError(err);
  }
}
