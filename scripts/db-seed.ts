/** Legger inn kommuner og seed-spørsmål som mangler (overskriver aldri redaksjonelle endringer). */
import { createPgliteDb, createPostgresDb, databaseUrl, runMigrations } from "../src/lib/db/client";
import { seedKommuner, seedQuestionBank } from "../src/lib/db/seed";

async function main() {
  const url = databaseUrl();
  const db = url ? await createPostgresDb(url) : await createPgliteDb(process.env.PGLITE_DIR ?? ".data/pglite");
  await runMigrations(db);
  const k = await seedKommuner(db);
  const q = await seedQuestionBank(db);
  console.log(`Kommuner lagt inn: ${k}. Spørsmål lagt inn: ${q.inserted}.`);
  if (q.invalid.length) {
    console.error(`Ugyldige seed-spørsmål:\n${q.invalid.join("\n")}`);
    process.exitCode = 1;
  }
  await db.close();
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
