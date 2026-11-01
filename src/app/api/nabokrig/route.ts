import { NextResponse } from "next/server";
import { getDb } from "@/lib/db/client";
import { weeklyStandings } from "@/lib/nabokrig/queries";
import { localDate, isIsoDate } from "@/lib/game/dates";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const d = new URL(req.url).searchParams.get("date");
  const date = d && isIsoDate(d) ? d : localDate();
  const rows = await weeklyStandings(await getDb(), date);
  return NextResponse.json(rows, { headers: { "Cache-Control": "public, max-age=30, s-maxage=60" } });
}
