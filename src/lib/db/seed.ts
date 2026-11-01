/**
 * Seed av referansedata (kommuner) og startbanken med spørsmål.
 * Idempotent: setter bare inn det som mangler, og overskriver aldri redaksjonelle endringer.
 */
import type { Db } from "./client";
import kommunerDoc from "../../../content/kommuner.json";
import { seedQuestions } from "../../../content/questions/index";
import { parseQuestion, type QuestionStatus } from "../game/schema";
import { saveQuestion } from "./questions";
import { validateQuestion } from "../qa/validate";

interface KommuneSeed {
  nr: string;
  name: string;
  altNames: string[];
  slug: string;
  fylkeNr: string;
  fylkeName: string;
  population: number;
  areaKm2: number;
}

export async function seedKommuner(db: Db): Promise<number> {
  const existing = await db.one<{ n: number }>(`SELECT count(*)::int AS n FROM kommuner`);
  if ((existing?.n ?? 0) > 0) return 0;
  const list = (kommunerDoc as { kommuner: KommuneSeed[]; _meta: { populationDate: string } }).kommuner;
  const date = (kommunerDoc as { _meta: { populationDate: string } })._meta.populationDate;
  // Én spørring med jsonb_to_recordset er raskt også i PGlite.
  await db.query(
    `INSERT INTO kommuner (nr, name, slug, fylke_nr, fylke_name, alt_names, population, population_date, population_source, area_km2)
     SELECT nr, name, slug, "fylkeNr", "fylkeName", "altNames", population, $2, 'seed: SSB folketall 1.1.2024 via @aprestmo/norway-geodata', "areaKm2"
     FROM jsonb_to_recordset($1::jsonb) AS x(nr text, name text, slug text, "fylkeNr" text, "fylkeName" text, "altNames" jsonb, population int, "areaKm2" double precision)
     ON CONFLICT (nr) DO NOTHING`,
    [JSON.stringify(list), date],
  );
  return list.length;
}

/** Høyrisiko-spørsmål krever alltid manuell godkjenning – også i seed. */
export function seedStatusFor(risk: string): QuestionStatus {
  return risk === "high" ? "review_required" : "approved";
}

export async function seedQuestionBank(db: Db): Promise<{ inserted: number; invalid: string[] }> {
  const invalid: string[] = [];
  let inserted = 0;
  const existingIds = new Set((await db.query<{ id: string }>(`SELECT id FROM questions`)).map((r) => r.id));
  const allPrompts = (await db.query<{ id: string; prompt: string }>(`SELECT id, content->>'prompt' AS prompt FROM questions`)).map(
    (r) => ({ id: r.id, prompt: r.prompt }),
  );
  for (const raw of seedQuestions) {
    const parsed = parseQuestion(raw);
    if (!parsed.ok) {
      invalid.push(`${(raw as { id?: string })?.id ?? "?"}: ${parsed.errors.join("; ")}`);
      continue;
    }
    const q = parsed.value;
    if (existingIds.has(q.id)) continue;
    const qa = validateQuestion(q, { existing: allPrompts.filter((p) => p.id !== q.id), today: q.lastVerified });
    const status = qa.ok ? seedStatusFor(q.risk) : "review_required";
    await saveQuestion(db, q, {
      status,
      actor: "seed",
      origin: "seed",
      note: "Startbank – manuelt kuratert og kildekontrollert",
      qa: { ok: qa.ok, errors: qa.errors, warnings: qa.warnings, flags: qa.flags, checkedAt: new Date().toISOString() },
      scores: { priority: q.dataQuality / 5 },
    });
    allPrompts.push({ id: q.id, prompt: q.prompt });
    inserted++;
  }
  return { inserted, invalid };
}

export async function seedIfEmpty(db: Db): Promise<void> {
  const res = await db.tx(async (tx) => {
    await tx.query(`SELECT pg_advisory_xact_lock($1)`, [727_274_002]);
    await seedKommuner(tx);
    return seedQuestionBank(tx);
  });
  if (res.invalid.length) {
    console.warn(`[seed] ${res.invalid.length} ugyldige seed-spørsmål:\n${res.invalid.join("\n")}`);
  }
}
