/**
 * Genererer PWA-ikoner med prosjektets egen skrift (Archivo) i en hodeløs nettleser.
 * Kjør: npm run icons
 */
import { chromium } from "playwright";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const font = readFileSync(join(root, "src/fonts/archivo-latin-standard-normal.woff2")).toString("base64");

const targets: { file: string; size: number; safe: number }[] = [
  { file: "icon-192.png", size: 192, safe: 0.86 },
  { file: "icon-512.png", size: 512, safe: 0.86 },
  { file: "icon-maskable-512.png", size: 512, safe: 0.66 },
  { file: "apple-touch-icon.png", size: 180, safe: 0.8 },
];

function html(size: number, safe: number) {
  const fs = Math.round(size * safe * 0.42);
  const dot = Math.max(2, Math.round(size / 70));
  return `<!doctype html><html><head><style>
  @font-face{font-family:A;src:url(data:font/woff2;base64,${font}) format("woff2");font-weight:100 900;font-stretch:62% 125%}
  html,body{margin:0;width:${size}px;height:${size}px;background:#2b3bff;overflow:hidden}
  .wrap{position:relative;width:100%;height:100%;display:grid;place-items:center}
  .dots{position:absolute;right:${Math.round(size * 0.1)}px;top:${Math.round(size * 0.1)}px;width:${Math.round(size * 0.22)}px;height:${Math.round(size * 0.22)}px;
    background-image:radial-gradient(#e2f53b 32%,transparent 34%);background-size:${dot * 4}px ${dot * 4}px;opacity:.7;border-radius:50%}
  .t{font-family:A;font-weight:900;font-stretch:78%;font-size:${fs}px;line-height:1;color:#f4ede0;letter-spacing:-0.02em;
    text-shadow:${Math.max(2, Math.round(size / 80))}px ${Math.max(2, Math.round(size / 80))}px 0 #ff5a36}
  .q{color:#e2f53b}
  .bar{position:absolute;left:50%;transform:translateX(-50%);bottom:${Math.round(size * (0.5 - safe / 2) + size * 0.06)}px;width:${Math.round(size * safe * 0.7)}px;height:${Math.max(3, Math.round(size / 64))}px;
    background-image:radial-gradient(circle,#f4ede0 45%,transparent 50%);background-size:${Math.max(6, Math.round(size / 32))}px 100%}
  </style></head><body><div class="wrap"><div class="dots"></div><div class="t">T<span class="q">?</span>LL</div><div class="bar"></div></div></body></html>`;
}

async function main() {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  for (const t of targets) {
    await page.setViewportSize({ width: t.size, height: t.size });
    await page.setContent(html(t.size, t.safe));
    await page.evaluate(() => document.fonts.ready);
    writeFileSync(join(root, "public/icons", t.file), await page.screenshot({ type: "png" }));
    console.log("✓", t.file);
  }
  await browser.close();
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
