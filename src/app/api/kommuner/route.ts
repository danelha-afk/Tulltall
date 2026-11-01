import { NextResponse } from "next/server";
import { getDb } from "@/lib/db/client";
import { listKommuner } from "@/lib/nabokrig/queries";

export const dynamic = "force-dynamic";

export async function GET() {
  const rows = await listKommuner(await getDb());
  return NextResponse.json(
    rows.map((k) => ({ nr: k.nr, name: k.name, slug: k.slug, fylke: k.fylke_name, alt: k.alt_names })),
    { headers: { "Cache-Control": "public, max-age=3600, s-maxage=86400" } },
  );
}
