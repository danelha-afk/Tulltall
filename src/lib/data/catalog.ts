/**
 * Overvåkingskatalogen: SSB-tabeller datamotoren følger med på, hvordan utvalget lages,
 * og hvilke mål (measures) som beregnes. Nye tabeller legges til her.
 *
 * Tabeller merket `verified: false` er lagt inn etter dokumentasjon, men ikke prøvekjørt mot
 * API-et fra utviklingsmiljøet. Den ukentlige jobben rapporterer om utvalget feiler.
 */
import type { SelectionRule } from "./selection";

export interface MeasureSpec {
  key: string;
  label: string;
  unit: { suffix: string; prefix: string; decimals: number };
  /** Summer over disse dimensjonene (f.eks. kjønn og alder). */
  sumOver: string[];
  /** Valgfritt filter for teller (koder eller numerisk intervall på koden). */
  filter?: Record<string, { codes?: string[]; min?: number; max?: number }>;
  /** Hvis satt: verdien er teller / nevner × 100. */
  ratioOf?: { sumOver: string[]; filter?: Record<string, { codes?: string[]; min?: number; max?: number }> };
  /** Minste nevner/base for at et tall regnes som robust. */
  minBase?: number;
}

export interface CatalogEntry {
  key: string;
  tableId: string;
  title: string;
  topic: string;
  category: "fun" | "misconception" | "current";
  verified: boolean;
  rules: Record<string, SelectionRule>;
  geoDim?: string;
  timeDim: string;
  measures: MeasureSpec[];
  analyses: ("extremes" | "rivalry" | "change" | "stable" | "rank" | "trend")[];
  /** Hvor kjent temaet er for folk flest (1–5) – brukes i prioriteringen. */
  recognizability: number;
  seasonMonths?: number[];
  sourceTitle: string;
  sourceUrl: string;
}

export const CATALOG: CatalogEntry[] = [
  {
    key: "befolkning-kommune",
    tableId: "07459",
    title: "Befolkning etter kommune, kjønn og alder",
    topic: "befolkning",
    category: "fun",
    verified: false,
    rules: { Region: { kind: "kommuner" }, Kjonn: { kind: "all" }, Alder: { kind: "all" }, ContentsCode: { kind: "first" }, Tid: { kind: "last", n: 6 } },
    geoDim: "Region",
    timeDim: "Tid",
    measures: [
      { key: "folketall", label: "Folketall", unit: { suffix: "innbyggere", prefix: "", decimals: 0 }, sumOver: ["Kjonn", "Alder"] },
      {
        key: "andel-67",
        label: "Andel innbyggere 67 år og eldre",
        unit: { suffix: "%", prefix: "", decimals: 1 },
        sumOver: ["Kjonn", "Alder"],
        filter: { Alder: { min: 67 } },
        ratioOf: { sumOver: ["Kjonn", "Alder"] },
        minBase: 2000,
      },
      {
        key: "andel-barn",
        label: "Andel innbyggere under 18 år",
        unit: { suffix: "%", prefix: "", decimals: 1 },
        sumOver: ["Kjonn", "Alder"],
        filter: { Alder: { max: 17 } },
        ratioOf: { sumOver: ["Kjonn", "Alder"] },
        minBase: 2000,
      },
    ],
    analyses: ["extremes", "rivalry", "change", "rank"],
    recognizability: 5,
    sourceTitle: "Befolkning, etter region, kjønn, alder og år (tabell 07459)",
    sourceUrl: "https://www.ssb.no/statbank/table/07459",
  },
  {
    key: "kpi-tolvmaaned",
    tableId: "03013",
    title: "Konsumprisindeksen",
    topic: "økonomi",
    category: "current",
    verified: false,
    rules: { Konsumgrp: { kind: "total" }, ContentsCode: { kind: "label", regex: "12-måneders|tolvmåneders" }, Tid: { kind: "last", n: 25 } },
    timeDim: "Tid",
    measures: [{ key: "kpi-12m", label: "Prisvekst siste 12 måneder (KPI)", unit: { suffix: "%", prefix: "", decimals: 1 }, sumOver: [] }],
    analyses: ["trend", "change"],
    recognizability: 5,
    sourceTitle: "Konsumprisindeksen (tabell 03013)",
    sourceUrl: "https://www.ssb.no/statbank/table/03013",
  },
];

export function catalogByKey(key: string): CatalogEntry | undefined {
  return CATALOG.find((c) => c.key === key);
}
