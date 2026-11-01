/** Planlegger daglige runder fremover (standard 14 dager). */
import { createPgliteDb, createPostgresDb, databaseUrl, runMigrations } from "../src/lib/db/client";
import { scheduleUpcoming } from "../src/lib/db/games";
import { localDate } from "../src/lib/game/dates";

async function main() {
  const url = databaseUrl();
  const db = url ? await createPostgresDb(url) : await createPgliteDb(process.env.PGLITE_DIR ?? ".data/pglite");
  await runMigrations(db);
  const days = Number(process.argv[2] ?? 14);
  const games = await scheduleUpcoming(db, localDate(), days);
  for (const g of games) console.log(`${g.game_date}: ${(g.question_ids as string[]).join(", ")}`);
  await db.close();
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
