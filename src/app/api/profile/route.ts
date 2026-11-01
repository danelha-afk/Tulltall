import { z } from "zod";
import { NextResponse } from "next/server";
import { getDb } from "@/lib/db/client";
import { guardRate, handleError, jsonError, readJson, sameOrigin } from "@/lib/http";
import { ensurePlayer } from "@/lib/play/service";
import { getProfile, updateProfile } from "@/lib/profile/service";
import { localDate } from "@/lib/game/dates";

export const dynamic = "force-dynamic";

const Body = z.object({
  playerId: z.string().uuid(),
  action: z.enum(["get", "update"]),
  showOnLists: z.boolean().optional(),
  /** Tekst = selvvalgt navn (filtreres), null = nytt tilfeldig navn. */
  customName: z.string().max(40).nullable().optional(),
});

const MESSAGES: Record<string, string> = {
  short: "For kort navn",
  long: "For langt navn",
  chars: "Ugyldige tegn",
  blocked: "Navnet kan ikke brukes",
  personal: "Ikke bruk personopplysninger",
  taken: "Navnet er tatt",
  not_found: "Ukjent spiller",
};

export async function POST(req: Request) {
  if (!sameOrigin(req)) return jsonError(403, "forbidden", "Ugyldig opphav");
  try {
    const db = await getDb();
    const limited = await guardRate(db, req, "profile", 120, 3600);
    if (limited) return limited;
    const body = await readJson(req, Body);
    const id = await ensurePlayer(db, body.playerId);
    if (body.action === "update") {
      const res = await updateProfile(db, id, { showOnLists: body.showOnLists, customName: body.customName });
      if (!res.ok) return jsonError(400, res.error, MESSAGES[res.error] ?? "Kunne ikke lagre");
    }
    const profile = await getProfile(db, id, localDate());
    return NextResponse.json({ profile }, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    return handleError(err);
  }
}
