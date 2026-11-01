import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestDb, type Db } from "@/lib/db/client";
import { runWeekly } from "@/lib/pipeline/weekly";
import { parseJsonStat } from "@/lib/data/ssb/jsonstat";
import { syntheticPopulationDataset } from "@/lib/data/fixtures";
import { CATALOG } from "@/lib/data/catalog";
import { analyze, computeMeasures } from "@/lib/data/analysis";
import { templateOnlyEditor, type EditorialClient, type Editorial } from "@/lib/editorial/claude";
import { produceCandidates } from "@/lib/editorial/pipeline";

let db: Db;
const ds = parseJsonStat(syntheticPopulationDataset());
const entry = CATALOG.find((c) => c.key === "befolkning-kommune")!;
const fixtures = { "befolkning-kommune": { metadata: ds, data: ds, updated: "2026-02-20T07:00:00Z", synthetic: true as const } };

beforeAll(async () => {
  db = await createTestDb();
});
afterAll(async () => {
  await db.close();
});

describe("statistisk analyse", () => {
  it("beregner andeler deterministisk fra rådata", () => {
    const t = computeMeasures(ds, entry);
    const oslo = t.get("andel-67")!.get("0301")!.get("2026")!;
    expect(oslo.value).toBeGreaterThan(0);
    expect(oslo.value).toBeLessThan(100);
    const pop = t.get("folketall")!.get("0301")!.get("2026")!;
    expect(pop.value).toBeGreaterThan(100_000);
  });

  it("holder små kommuner utenfor andelsfunn", () => {
    const labels = new Map<string, string>();
    const f = analyze({ entry, data: ds, queryUrl: "fixture://07459", sourceUpdated: null, geoLabels: labels, bigCities: ["4601", "5001", "1103", "3201"] });
    const extremes = f.filter((x) => x.kind === "extremes" && x.measure.key === "andel-67");
    expect(extremes.length).toBe(1);
    expect(extremes[0].guards.excludedSmall).toBeGreaterThan(0);
    expect(f.some((x) => x.kind === "rivalry")).toBe(true);
  });
});

describe("hele løpet: tabell → funn → spørsmål → faktakontroll → kø", () => {
  it("lager kandidater som aldri kan publiseres fra syntetiske data", async () => {
    const report = await runWeekly(db, { client: null, catalog: [entry], fixtures, editor: templateOnlyEditor, kind: "test", log: () => undefined });
    expect(report.ingest[0].status).toBe("new_version");
    expect(report.findings).toBeGreaterThan(3);
    expect(report.candidates.length).toBeGreaterThan(0);
    const rows = await db.query<{ status: string; qa: { flags: string[] } }>(`SELECT status, qa FROM questions WHERE origin = 'pipeline'`);
    expect(rows.length).toBeGreaterThan(0);
    for (const r of rows) {
      expect(["validated", "draft"]).toContain(r.status);
      expect(r.qa.flags.join()).toMatch(/SYNTETISK/);
    }
    const versions = await db.query<{ synthetic: boolean }>(`SELECT synthetic FROM dataset_versions`);
    expect(versions.every((v) => v.synthetic)).toBe(true);
    expect(report.markdown).toMatch(/Produksjonsrapport/);
  });

  it("andre kjøring med samme data gir ingen ny versjon", async () => {
    const report = await runWeekly(db, { client: null, catalog: [entry], fixtures, editor: templateOnlyEditor, kind: "test", log: () => undefined });
    expect(report.ingest[0].status).toBe("unchanged");
  });

  it("stopper KI-tekst som finner på tall, selv om KI sier den er bra", async () => {
    const liar: EditorialClient = {
      async enhance(_f, draft) {
        const ed: Editorial = {
          include: true,
          kicker: "Test",
          prompt: draft.question.prompt,
          headline: "Hele 99 999 flere enn naboen!",
          explanation: "Forskjellen er hele 99 999 innbyggere.",
          deepDive: null,
          caveats: [],
          shareText: "Gjett!",
          tone: "playful",
          misconceptionAngle: null,
          visualizationHint: "",
          scores: { surprise: 5, recognizability: 5, socialRelevance: 5, humor: 5, competition: 5, enlightenment: 5, visual: 5, shareability: 5 },
          needsManualReview: false,
          reviewReasons: [],
          suggestedRisk: "low",
        };
        return { editorial: ed, model: "stub", inputTokens: 100, outputTokens: 50, costUsd: 0.001 };
      },
    };
    const fresh = await createTestDb({ seed: false });
    await fresh.exec(`INSERT INTO kommuner (nr, name, slug, fylke_nr, fylke_name) VALUES ('4601','Bergen','bergen','46','Vestland'), ('1103','Stavanger','stavanger','11','Rogaland')`);
    const f = analyze({ entry, data: ds, queryUrl: "https://data.ssb.no/test", sourceUpdated: null, geoLabels: new Map(), bigCities: [] }).filter((x) => x.kind === "rivalry").slice(0, 1);
    await fresh.query(`INSERT INTO datasets (id, source_id, table_id, title, catalog_key) VALUES ('ssb:07459:befolkning-kommune','ssb','07459','t','befolkning-kommune')`);
    const { results } = await produceCandidates(fresh, f, liar, { today: "2026-11-01", budgetUsd: 1, maxCandidates: 5 });
    expect(results.length).toBe(1);
    expect(results[0].status).toBe("draft");
    expect(results[0].errors.join()).toMatch(/99999/);
    const usage = await fresh.one<{ n: number }>(`SELECT count(*)::int AS n FROM ai_usage`);
    expect(usage?.n).toBe(1);
    await fresh.close();
  });
});
