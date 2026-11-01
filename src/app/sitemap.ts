import type { MetadataRoute } from "next";
import { brand } from "@/lib/config/brand";
import { getDb } from "@/lib/db/client";

export const dynamic = "force-dynamic";

/** Sitemap: produktets faktiske sider – ingen masseproduserte SEO-artikler. */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = brand.url;
  const statics = ["", "/spill", "/nabokrigen", "/om", "/kilder", "/personvern"].map((p) => ({
    url: `${base}${p}`,
    changeFrequency: "daily" as const,
    priority: p === "" ? 1 : 0.6,
  }));
  const db = await getDb();
  const kommuner = await db.query<{ slug: string }>(`SELECT slug FROM kommuner ORDER BY slug`);
  return [
    ...statics,
    ...kommuner.map((k) => ({ url: `${base}/kommune/${k.slug}`, changeFrequency: "weekly" as const, priority: 0.4 })),
  ];
}
