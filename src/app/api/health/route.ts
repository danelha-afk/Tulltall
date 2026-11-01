import { NextResponse } from "next/server";
import { databaseUrls, getDb } from "@/lib/db/client";
import { safeEqual } from "@/lib/security/crypto";

export const dynamic = "force-dynamic";

/** Tilkoblingsdetaljer uten passord – kun for innlogget eier (?key=ADMIN_PASSWORD). */
function connectionInfo() {
  const connectedVia = (globalThis as { __tulltallDbSource?: string }).__tulltallDbSource ?? null;
  const urls = databaseUrls();
  if (!urls.length) return { connectedVia, candidates: [], note: "Ingen DATABASE_URL/POSTGRES_URL funnet (bruker lokal PGlite)" };
  return {
    connectedVia,
    candidates: urls.map(({ name, url }) => {
      try {
        const u = new URL(url);
        return {
          name,
          user: decodeURIComponent(u.username),
          host: u.hostname,
          port: u.port || "5432",
          database: u.pathname.slice(1),
          passwordLength: decodeURIComponent(u.password).length,
        };
      } catch {
        return { name, problem: "Adressen kan ikke leses" };
      }
    }),
  };
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
