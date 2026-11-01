import { NextResponse } from "next/server";
import { getDb } from "@/lib/db/client";
import { isIsoDate, localDate, weekRange } from "@/lib/game/dates";
import { topDaily, topWeekly } from "@/lib/toplist/queries";
import { handleError } from "@/lib/http";

export const dynamic = "force-dynamic";

/** Offentlig topp 10 – bare spillere som selv har sagt ja vises. Kan mellomlagres kort. */
export async function GET(req: Request) {
  try {
    const sp = new URL(req.url).searchParams;
    const period = sp.get("period") === "week" ? "week" : "day";
    const d = sp.get("date");
    const date = d && isIsoDate(d) ? d : localDate();
    const db = await getDb();
    const rows = period === "week" ? await topWeekly(db, weekRange(date).start, weekRange(date).end) : await topDaily(db, date);
    return NextResponse.json({ period, date, rows }, { headers: { "Cache-Control": "public, max-age=0, s-maxage=10, stale-while-revalidate=30" } });
  } catch (err) {
    return handleError(err);
  }
}
