/**
 * Validerer seed-banken: skjema, semantikk og redaksjonelle regler.
 * Kjør: npm run content:validate
 */
import { seedQuestions } from "../content/questions/index";
import { parseQuestion } from "../src/lib/game/schema";
import { validateQuestion } from "../src/lib/qa/validate";
import { seedStatusFor } from "../src/lib/db/seed";

let failed = 0;
const existing: { id: string; prompt: string }[] = [];
const counts: Record<string, number> = {};
const statusCounts: Record<string, number> = {};
const verbose = process.argv.includes("--verbose");

for (const raw of seedQuestions) {
  const id = (raw as { id?: string }).id ?? "?";
  const parsed = parseQuestion(raw);
  if (!parsed.ok) {
    failed++;
    console.log(`✗ ${id}\n  ${parsed.errors.join("\n  ")}`);
    continue;
  }
  const q = parsed.value;
  const qa = validateQuestion(q, { existing, today: q.lastVerified });
  existing.push({ id: q.id, prompt: q.prompt });
  const key = `${q.category}/${q.payload.format}`;
  counts[key] = (counts[key] ?? 0) + 1;
  const status = qa.ok ? seedStatusFor(q.risk) : "review_required";
  statusCounts[status] = (statusCounts[status] ?? 0) + 1;
  if (!qa.ok) {
    failed++;
    console.log(`✗ ${id}\n  ${qa.errors.join("\n  ")}`);
  } else if (verbose || qa.flags.length) {
    console.log(`• ${id} [${q.risk}] ${qa.flags.join("; ")}${verbose && qa.warnings.length ? `\n  ⚠ ${qa.warnings.join("\n  ⚠ ")}` : ""}`);
  }
}
console.log("\nFordeling:", counts);
console.log("Status ved seed:", statusCounts);
console.log(`${seedQuestions.length} spørsmål, ${failed} med feil.`);
process.exit(failed ? 1 : 0);
