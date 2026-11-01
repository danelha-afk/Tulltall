import { z } from "zod";
import { NextResponse } from "next/server";
import { guardRate, handleError, readJson, sameOrigin, jsonError } from "@/lib/http";
import { getDb } from "@/lib/db/client";
import { ensurePlayer, sanitizeNickname } from "@/lib/play/service";
import { LIMITS } from "@/lib/security/ratelimit";

export const dynamic = "force-dynamic";

const Body = z.object({
  playerId: z.string().max(64).nullish(),
  kommuneNr: z.string().regex(/^\d{4}$/).nullish(),
  relation: z.enum(["bor", "heier"]).nullish(),
  nickname: z.string().max(40).nullish(),
});

/** Lagrer spillerens frivillige valg (kommune og kallenavn). Ingen andre personopplysninger. */
export async function POST(req: Request) {
  if (!sameOrigin(req)) return jsonError(403, "forbidden", "Ugyldig opphav");
  try {
    const db = await getDb();
    const limited = await guardRate(db, req, "player", LIMITS.player.limit, LIMITS.player.window);
    if (limited) return limited;
    const body = await readJson(req, Body);
    const id = await ensurePlayer(db, body.playerId);
    if (body.kommuneNr) {
      const k = await db.one(`SELECT nr FROM kommuner WHERE nr = $1`, [body.kommuneNr]);
      if (!k) return jsonError(400, "bad_request", "Ukjent kommune");
    }
    await db.query(
      `UPDATE players SET kommune_nr = $2, kommune_relation = $3, nickname = COALESCE($4, nickname) WHERE id = $1`,
      [id, body.kommuneNr ?? null, body.kommuneNr ? (body.relation ?? "heier") : null, sanitizeNickname(body.nickname)],
    );
    return NextResponse.json({ playerId: id }, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    return handleError(err);
  }
}

/** Sletting av egne serverdata (personvern): fjerner spiller, økter og tilknyttede varsler. */
export async function DELETE(req: Request) {
  if (!sameOrigin(req)) return jsonError(403, "forbidden", "Ugyldig opphav");
  try {
    const db = await getDb();
    const body = await readJson(req, z.object({ playerId: z.string().uuid() }));
    await db.tx(async (tx) => {
      await tx.query(`DELETE FROM push_subscriptions WHERE player_id = $1`, [body.playerId]);
      await tx.query(`UPDATE events SET player_id = NULL WHERE player_id = $1`, [body.playerId]);
      await tx.query(`UPDATE sessions SET nickname = NULL, ip_hash = NULL WHERE player_id = $1`, [body.playerId]);
      await tx.query(`UPDATE players SET kommune_nr = NULL, kommune_relation = NULL, nickname = NULL WHERE id = $1`, [body.playerId]);
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleError(err);
  }
}
