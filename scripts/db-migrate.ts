/** Kjører databasemigrasjoner mot DATABASE_URL (eller lokal PGlite). */
import { createPgliteDb, createPostgresDb, runMigrations } from "../src/lib/db/client";

async function main() {
  const url = process.env.DATABASE_URL;
  const db = url ? await createPostgresDb(url) : await createPgliteDb(process.env.PGLITE_DIR ?? ".data/pglite");
  const applied = await runMigrations(db);
  console.log(applied.length ? `Kjørte migrasjoner: ${applied.join(", ")}` : "Databasen er oppdatert – ingen nye migrasjoner.");
  await db.close();
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
