/**
 * SYNTETISKE TESTDATA – IKKE EKTE SSB-TALL.
 *
 * Brukes kun i tester og i `npm run pipeline:demo` for å vise hele løpet fra tabell til spørsmål
 * uten nettverkstilgang. Datasettet har samme struktur som SSB-tabell 07459 (JSON-stat 2.0), men
 * verdiene er generert. Spørsmål laget fra disse dataene merkes og kan aldri publiseres.
 */
import kommunerDoc from "../../../content/kommuner.json";
import type { JsonStatDataset } from "./ssb/jsonstat";
import { seededRandom } from "../game/prng";

const AGES = ["000", "010", "018", "030", "045", "060", "067", "080"];
const YEARS = ["2021", "2022", "2023", "2024", "2025", "2026"];

export function syntheticPopulationDataset(): JsonStatDataset {
  const kommuner = (kommunerDoc as { kommuner: { nr: string; name: string; population: number }[] }).kommuner;
  const rand = seededRandom("syntetisk-07459");
  const value: number[] = [];
  for (const k of kommuner) {
    const growth = 0.97 + rand() * 0.08; // syntetisk vekst over perioden
    const oldShare = 0.12 + rand() * 0.18;
    for (const _sex of ["1", "2"]) {
      for (const age of AGES) {
        const share = age === "067" ? oldShare * 0.6 : age === "080" ? oldShare * 0.4 : (1 - oldShare) / 6;
        for (let y = 0; y < YEARS.length; y++) {
          const f = 1 + ((growth - 1) * y) / (YEARS.length - 1);
          value.push(Math.round((k.population / 2) * share * f));
        }
      }
    }
  }
  return {
    version: "2.0",
    class: "dataset",
    label: "SYNTETISKE TESTDATA – Befolkning etter region, kjønn, alder og år",
    source: "Generert lokalt (ikke SSB)",
    updated: "2026-02-20T07:00:00Z",
    id: ["Region", "Kjonn", "Alder", "ContentsCode", "Tid"],
    size: [kommuner.length, 2, AGES.length, 1, YEARS.length],
    dimension: {
      Region: { label: "region", category: { index: Object.fromEntries(kommuner.map((k, i) => [k.nr, i])), label: Object.fromEntries(kommuner.map((k) => [k.nr, k.name])) } },
      Kjonn: { label: "kjønn", category: { index: { "1": 0, "2": 1 }, label: { "1": "Menn", "2": "Kvinner" } } },
      Alder: { label: "alder", category: { index: Object.fromEntries(AGES.map((a, i) => [a, i])), label: Object.fromEntries(AGES.map((a) => [a, `${Number(a)} år`])) } },
      ContentsCode: { label: "statistikkvariabel", category: { index: { Personer1: 0 }, label: { Personer1: "Personer" }, unit: { Personer1: { base: "personer", decimals: 0 } } } },
      Tid: { label: "år", category: { index: Object.fromEntries(YEARS.map((y, i) => [y, i])), label: Object.fromEntries(YEARS.map((y) => [y, y])) } },
    },
    value,
    role: { time: ["Tid"], geo: ["Region"], metric: ["ContentsCode"] },
    extension: { synthetic: true },
  };
}
