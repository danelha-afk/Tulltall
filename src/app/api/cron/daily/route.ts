import { NextResponse } from "next/server";
import { getDb } from "@/lib/db/client";
import { publishDailyGame, scheduleUpcoming } from "@/lib/db/games";
import { addDays, localDate } from "@/lib/game/dates";
import { sendDailyPush } from "@/lib/push/webpush";
import { safeEqual } from "@/lib/security/crypto";
import { brand } from "@/lib/config/brand";
import { t } from "@/lib/i18n";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Daglig jobb (Vercel Cron eller GitHub Actions): publiserer dagens runde, planlegger
 * neste uke og sender ett varsel til dem som har bedt om det.
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization") ?? "";
  if (!secret || !safeEqual(auth, `Bearer ${secret}`)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const db = await getDb();
  const today = localDate();
  const run = await db.one<{ id: number }>(`INSERT INTO pipeline_runs (kind) VALUES ('daily') RETURNING id`);
  try {
    const game = await publishDailyGame(db, today);
    const scheduled = await scheduleUpcoming(db, addDays(today, 1), 7);
    const push = await sendDailyPush(db, {
      title: t("push.title"),
      body: t("push.body"),
      url: `${brand.url}/spill`,
      tag: `daily-${today}`,
    });
    const stats = { published: game?.id ?? null, scheduled: scheduled.map((g) => g.id), push };
    await db.query(`UPDATE pipeline_runs SET finished_at = now(), status = 'ok', stats = $2::jsonb WHERE id = $1`, [run!.id, JSON.stringify(stats)]);
    return NextResponse.json({ ok: true, ...stats });
  } catch (err) {
    await db.query(`UPDATE pipeline_runs SET finished_at = now(), status = 'failed', errors = $2::jsonb WHERE id = $1`, [
      run!.id,
      JSON.stringify([String((err as Error).message)]),
    ]);
    return NextResponse.json({ ok: false, error: (err as Error).message }, { status: 500 });
  }
}
