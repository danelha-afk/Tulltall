/**
 * Ukentlig innholdsjobb. Kjøres av .github/workflows/weekly-content.yml (eller manuelt).
 *   npm run pipeline:weekly            – vanlig kjøring (henter bare oppdaterte tabeller)
 *   npm run pipeline:weekly -- --force – hent og analyser alt på nytt
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { createPgliteDb, createPostgresDb, runMigrations } from "../src/lib/db/client";
import { seedIfEmpty } from "../src/lib/db/seed";
import { alert, runWeekly } from "../src/lib/pipeline/weekly";
import { localDate } from "../src/lib/game/dates";

async function main() {
  const url = process.env.DATABASE_URL;
  const db = url ? await createPostgresDb(url) : await createPgliteDb(process.env.PGLITE_DIR ?? ".data/pglite");
  await runMigrations(db);
  await seedIfEmpty(db);
  const report = await runWeekly(db, { force: process.argv.includes("--force") });
  mkdirSync("reports", { recursive: true });
  const file = `reports/weekly-${localDate()}.md`;
  writeFileSync(file, report.markdown);
  console.log(`\n${report.markdown}\n\nRapport skrevet til ${file}`);
  if (report.status !== "ok") await alert(`TULL ELLER TALL?: ukentlig jobb endte med status ${report.status}.\n${report.errors.slice(0, 5).join("\n")}`);
  await db.close();
  if (report.status === "failed") process.exit(1);
}
main().catch(async (e) => {
  console.error(e);
  await alert(`TULL ELLER TALL?: ukentlig jobb krasjet: ${(e as Error).message}`);
  process.exit(1);
});
