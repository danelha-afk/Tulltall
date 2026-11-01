/**
 * Demonstrerer hele løpet fra tabell til kvalitetssikret spillspørsmål – uten nettverk.
 *
 * VIKTIG: Bruker SYNTETISKE TESTDATA med samme struktur som SSB-tabell 07459. Tallene er ikke ekte,
 * og spørsmålene som lages kan aldri publiseres (de stoppes av faktakontrollen). Med nettilgang
 * kjøres det samme løpet mot ekte data med `npm run pipeline:weekly`.
 */
import { createTestDb } from "../src/lib/db/client";
import { runWeekly } from "../src/lib/pipeline/weekly";
import { parseJsonStat } from "../src/lib/data/ssb/jsonstat";
import { syntheticPopulationDataset } from "../src/lib/data/fixtures";
import { CATALOG } from "../src/lib/data/catalog";
import { createClaudeEditor, templateOnlyEditor } from "../src/lib/editorial/claude";

async function main() {
  const db = await createTestDb();
  const ds = parseJsonStat(syntheticPopulationDataset());
  const entry = CATALOG.filter((c) => c.key === "befolkning-kommune");
  const report = await runWeekly(db, {
    client: null,
    catalog: entry,
    fixtures: { "befolkning-kommune": { metadata: ds, data: ds, updated: "2026-02-20T07:00:00Z", synthetic: true } },
    editor: process.env.ANTHROPIC_API_KEY && process.argv.includes("--claude") ? createClaudeEditor() : templateOnlyEditor,
    kind: "demo",
  });
  console.log(report.markdown);
  const errs = new Map<string, number>();
  for (const c of report.candidates) for (const e of c.errors) errs.set(e.replace(/\(.*\)/, "(…)"), (errs.get(e.replace(/\(.*\)/, "(…)")) ?? 0) + 1);
  if (errs.size) console.log("\nFeil i faktakontrollen:", Object.fromEntries(errs));
  const rows = await db.query<{ id: string; status: string; qa: { flags?: string[]; errors?: string[] }; content: { prompt: string; payload: unknown; reveal: unknown; sources: unknown } }>(
    `SELECT id, status, qa, content FROM questions WHERE origin = 'pipeline' ORDER BY id LIMIT 3`,
  );
  for (const r of rows) {
    console.log(`\n── ${r.id} [${r.status}]`);
    console.log(`Flagg: ${(r.qa.flags ?? []).join("; ") || "–"}`);
    console.log(JSON.stringify({ prompt: r.content.prompt, payload: r.content.payload, reveal: r.content.reveal, sources: r.content.sources }, null, 2));
  }
  await db.close();
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
