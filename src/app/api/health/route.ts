import { NextResponse } from "next/server";
import { getDb } from "@/lib/db/client";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const db = await getDb();
    const row = await db.one<{ n: number }>(`SELECT count(*)::int AS n FROM questions WHERE status IN ('approved','published')`);
    return NextResponse.json({ ok: true, db: db.kind, activeQuestions: row?.n ?? 0 });
  } catch (err) {
    return NextResponse.json({ ok: false, error: (err as Error).message }, { status: 503 });
  }
}
