import { test, expect } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

/** Alle tallspørsmål i startbanken (linjalen). */
function estimateIds(): string[] {
  const dir = path.join(process.cwd(), "content/questions");
  const ids: string[] = [];
  for (const f of ["current.json", "fun.json", "society.json"]) {
    const raw = JSON.parse(fs.readFileSync(path.join(dir, f), "utf8"));
    for (const q of Array.isArray(raw) ? raw : raw.questions) {
      if (q.payload?.format === "estimate" && q.status !== "review_required") ids.push(q.id);
    }
  }
  return ids;
}

const SIZES = [
  { name: "iPhone med Safari-felt", width: 390, height: 664 },
  { name: "liten Android", width: 360, height: 640 },
];

for (const size of SIZES) {
  test(`tallspørsmål: spørsmål, fire alternativer og Svar står på én skjerm (${size.name})`, async ({ page }) => {
    await page.setViewportSize({ width: size.width, height: size.height });
    const problems: string[] = [];
    let n = 0;
    for (const id of estimateIds()) {
      // Ny «avsender» per spørsmål, så ratebegrensningen på nye økter ikke slår inn.
      n++;
      await page.setExtraHTTPHeaders({ "x-forwarded-for": `10.${size.width % 250}.${Math.floor(n / 200)}.${n % 200}` });
      await page.goto(`/s/${id}`);
      const options = page.getByTestId("estimate-option");
      if ((await page.locator("h2").count()) === 0) continue; // ikke publisert i denne databasen
      await expect(options.first()).toBeVisible({ timeout: 15_000 });
      expect(await options.count(), id).toBe(4);
      // Mål FØR vi trykker (Playwright ruller ellers siden for å nå knappen).
      const lock = page.getByRole("button", { name: /^(Svar|Velg et tall først)$/ });
      await page.waitForTimeout(500); // inngangsanimasjonen
      const [h2, btn, last] = await Promise.all([page.locator("h2").first().boundingBox(), lock.boundingBox(), options.nth(3).boundingBox()]);
      const bottom = Math.max((btn?.y ?? 0) + (btn?.height ?? 0), (last?.y ?? 0) + (last?.height ?? 0));
      if ((h2?.y ?? 0) < 0 || bottom > size.height) problems.push(`${id}: knapp slutter på ${Math.round(bottom)} av ${size.height}`);
    }
    expect(problems, problems.join("\n")).toEqual([]);
  });
}
