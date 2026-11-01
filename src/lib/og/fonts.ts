import { readFile } from "node:fs/promises";
import { join } from "node:path";

let cache: { name: string; data: Buffer; weight: 500 | 800; style: "normal" }[] | null = null;

/** Statiske skrifter for delingsbilder (satori støtter ikke variable fonter/woff2). */
export async function ogFonts() {
  if (cache) return cache;
  const dir = join(process.cwd(), "src/fonts/og");
  const [a8, a5, m5] = await Promise.all([
    readFile(join(dir, "archivo-latin-800-normal.woff")),
    readFile(join(dir, "archivo-latin-500-normal.woff")),
    readFile(join(dir, "martian-mono-latin-500-normal.woff")),
  ]);
  cache = [
    { name: "Archivo", data: a8, weight: 800, style: "normal" },
    { name: "Archivo", data: a5, weight: 500, style: "normal" },
    { name: "Martian", data: m5, weight: 500, style: "normal" },
  ];
  return cache;
}

export const OG = {
  papir: "#f4ede0",
  blekk: "#17140f",
  kobolt: "#2b3bff",
  korall: "#ff5a36",
  syre: "#e2f53b",
  size: { width: 1200, height: 630 },
};
