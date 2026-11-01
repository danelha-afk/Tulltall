import { NextResponse } from "next/server";
import { databaseUrl, getDb } from "@/lib/db/client";
import { safeEqual } from "@/lib/security/crypto";

export const dynamic = "force-dynamic";

/** Tilkoblingsdetaljer uten passord – kun for innlogget eier (?key=ADMIN_PASSWORD). */
function connectionInfo() {
  const url = databaseUrl();
  if (!url) return { source: "ingen (lokal PGlite)" };
  const source = process.env.DATABASE_URL ? "DATABASE_URL" : "POSTGRES_URL";
  const raw = process.env.DATABASE_URL || process.env.POSTGRES_URL || "";
  try {
    const u = new URL(url);
    const pw = decodeURIComponent(u.password);
    return {
      source,
      user: decodeURIComponent(u.username),
      host: u.hostname,
      port: u.port || "5432",
      database: u.pathname.slice(1),
      passwordLength: pw.length,
      passwordFirstChar: pw.slice(0, 1),
      passwordLastChar: pw.slice(-1),
      passwordIsPlaceholder: /your-password|\[|\]/i.test(pw),
      hadWhitespaceInVariable: raw !== raw.trim() || /\s/.test(raw),
    };
  } catch {
    return { source, problem: "Adressen kan ikke leses (ugyldig format)" };
  }
}

export async function GET(req: Request) {
  const key = new URL(req.url).searchParams.get("key") ?? "";
  const admin = process.env.ADMIN_PASSWORD ?? "";
  const authorized = admin.length >= 10 && safeEqual(key, admin);
  try {
    const db = await getDb();
    const row = await db.one<{ n: number }>(`SELECT count(*)::int AS n FROM questions WHERE status IN ('approved','published')`);
    return NextResponse.json({ ok: true, db: db.kind, activeQuestions: row?.n ?? 0, ...(authorized ? { connection: connectionInfo() } : {}) });
  } catch (err) {
    return NextResponse.json({ ok: false, error: (err as Error).message, ...(authorized ? { connection: connectionInfo() } : {}) }, { status: 503 });
  }
}
