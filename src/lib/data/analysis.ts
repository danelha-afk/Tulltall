/**
 * Deterministisk statistisk analyse. All beregning skjer her – aldri i en språkmodell.
 * Resultatet er «funn» med alle tall ferdig regnet ut, som KI-redaksjonen bare får formulere.
 */
import { sha256 } from "../security/crypto";
import type { CatalogEntry, MeasureSpec } from "./catalog";
import type { ParsedDataset } from "./ssb/jsonstat";
import { RIVALRIES } from "../nabokrig/queries";

export type FindingKind = "extremes" | "rivalry" | "change" | "stable" | "rank" | "trend";

export interface FindingItem {
  code: string;
  label: string;
  value: number;
  base?: number;
}

export interface Finding {
  id: string;
  kind: FindingKind;
  catalogKey: string;
  tableId: string;
  measure: { key: string; label: string; unit: MeasureSpec["unit"] };
  period: string;
  fromPeriod?: string;
  items: FindingItem[];
  series?: { period: string; value: number }[];
  computed: Record<string, number>;
  guards: { smallNumbers: boolean; suppressed: number; minBase?: number; excludedSmall: number };
  heuristics: { surprise: number; recognizability: number; competition: number; visual: number; dataQuality: number };
  provenance: { queryUrl: string; sourceUpdated: string | null; sourceTitle: string; sourceUrl: string };
}

type Cell = { value: number; base: number; suppressed: number };
/** measure → geo ('*' for nasjonalt) → periode → verdi */
export type MeasureTable = Map<string, Map<string, Map<string, Cell>>>;

function codeNum(code: string): number {
  const n = parseInt(code.replace(/[^\d]/g, ""), 10);
  return Number.isFinite(n) ? n : NaN;
}

function passes(dims: Record<string, string>, filter?: MeasureSpec["filter"]): boolean {
  if (!filter) return true;
  for (const [dim, f] of Object.entries(filter)) {
    const code = dims[dim];
    if (code === undefined) return false;
    if (f.codes && !f.codes.includes(code)) return false;
    const n = codeNum(code);
    if (f.min !== undefined && !(n >= f.min)) return false;
    if (f.max !== undefined && !(n <= f.max)) return false;
  }
  return true;
}

export function computeMeasures(data: ParsedDataset, entry: CatalogEntry): MeasureTable {
  const out: MeasureTable = new Map();
  const geo = entry.geoDim;
  const time = entry.timeDim;
  for (const m of entry.measures) {
    const num = new Map<string, Cell>();
    const den = new Map<string, Cell>();
    const groupKey = (dims: Record<string, string>) => {
      const rest = Object.keys(dims)
        .filter((d) => d !== time && d !== geo && !m.sumOver.includes(d))
        .sort()
        .map((d) => `${d}=${dims[d]}`)
        .join("|");
      return `${geo ? dims[geo] : "*"}§${dims[time]}§${rest}`;
    };
    for (const o of data.observations) {
      const k = groupKey(o.dims);
      if (passes(o.dims, m.filter)) {
        const c = num.get(k) ?? { value: 0, base: 0, suppressed: 0 };
        if (o.value === null) c.suppressed++;
        else c.value += o.value;
        num.set(k, c);
      }
      if (m.ratioOf && passes(o.dims, m.ratioOf.filter)) {
        const c = den.get(k) ?? { value: 0, base: 0, suppressed: 0 };
        if (o.value === null) c.suppressed++;
        else c.value += o.value;
        den.set(k, c);
      }
    }
    const byGeo = new Map<string, Map<string, Cell>>();
    for (const [k, c] of num) {
      const [g, period] = k.split("§");
      let cell: Cell = c;
      if (m.ratioOf) {
        const d = den.get(k);
        if (!d || d.value <= 0) continue;
        cell = { value: (c.value / d.value) * 100, base: d.value, suppressed: c.suppressed + d.suppressed };
      } else {
        cell = { ...c, base: c.value };
      }
      const pm = byGeo.get(g) ?? new Map<string, Cell>();
      pm.set(period, cell);
      byGeo.set(g, pm);
    }
    out.set(m.key, byGeo);
  }
  return out;
}

const round = (v: number, d: number) => Math.round(v * 10 ** d) / 10 ** d;

function findingId(parts: unknown): string {
  return `f-${sha256(JSON.stringify(parts)).slice(0, 16)}`;
}

export interface AnalysisContext {
  entry: CatalogEntry;
  data: ParsedDataset;
  queryUrl: string;
  sourceUpdated: string | null;
  geoLabels: Map<string, string>;
  /** Folketall per geo (for minstegrenser), om tilgjengelig. */
  population?: Map<string, number>;
  bigCities?: string[];
}

export function analyze(ctx: AnalysisContext): Finding[] {
  const { entry, data } = ctx;
  const table = computeMeasures(data, entry);
  const timeDim = data.dimensions.find((d) => d.id === entry.timeDim);
  const periods = timeDim ? [...timeDim.codes] : [];
  if (periods.length === 0) return [];
  const latest = periods[periods.length - 1];
  const first = periods[0];
  const findings: Finding[] = [];
  const prov = { queryUrl: ctx.queryUrl, sourceUpdated: ctx.sourceUpdated, sourceTitle: entry.sourceTitle, sourceUrl: entry.sourceUrl };
  const label = (code: string) => ctx.geoLabels.get(code) ?? data.dimensions.find((d) => d.id === entry.geoDim)?.labels[code] ?? code;

  for (const m of entry.measures) {
    const byGeo = table.get(m.key);
    if (!byGeo) continue;
    const measure = { key: m.key, label: m.label, unit: m.unit };
    const dec = m.unit.decimals;

    if (entry.geoDim) {
      // Bare robuste tall: små kommuner holdes utenfor andeler/endringer.
      const rows: FindingItem[] = [];
      let excludedSmall = 0;
      let suppressed = 0;
      for (const [g, pm] of byGeo) {
        const c = pm.get(latest);
        if (!c) continue;
        suppressed += c.suppressed;
        const base = ctx.population?.get(g) ?? c.base;
        if (m.minBase && base < m.minBase) {
          excludedSmall++;
          continue;
        }
        if (c.suppressed > 0) continue;
        rows.push({ code: g, label: label(g), value: round(c.value, dec), base });
      }
      if (rows.length < 4) continue;
      const vals = rows.map((r) => r.value);
      const mean = vals.reduce((s, v) => s + v, 0) / vals.length;
      const sd = Math.sqrt(vals.reduce((s, v) => s + (v - mean) ** 2, 0) / vals.length) || 1;
      const sorted = [...rows].sort((a, b) => b.value - a.value);
      const guards = { smallNumbers: false, suppressed, minBase: m.minBase, excludedSmall };

      if (entry.analyses.includes("extremes")) {
        const top = sorted[0];
        const bottom = sorted[sorted.length - 1];
        const z = Math.abs(top.value - mean) / sd;
        findings.push({
          id: findingId(["extremes", entry.key, m.key, latest, top.code, bottom.code, top.value]),
          kind: "extremes",
          catalogKey: entry.key,
          tableId: entry.tableId,
          measure,
          period: latest,
          items: [top, ...sorted.slice(1, 3), bottom],
          computed: { mean: round(mean, dec), max: top.value, min: bottom.value, ratioMaxMin: bottom.value ? round(top.value / bottom.value, 2) : 0, zMax: round(z, 2), count: rows.length },
          guards,
          heuristics: { surprise: Math.min(1, z / 4), recognizability: entry.recognizability / 5, competition: 0.6, visual: 0.7, dataQuality: 0.9 },
          provenance: prov,
        });
      }

      if (entry.analyses.includes("rivalry")) {
        for (const [a, b] of RIVALRIES) {
          const ra = rows.find((r) => r.code === a);
          const rb = rows.find((r) => r.code === b);
          if (!ra || !rb) continue;
          const rel = Math.abs(ra.value - rb.value) / Math.max(Math.abs(ra.value), Math.abs(rb.value), 1e-9);
          if (rel < 0.08) continue; // for liten forskjell til et entydig spørsmål
          findings.push({
            id: findingId(["rivalry", entry.key, m.key, latest, a, b, ra.value, rb.value]),
            kind: "rivalry",
            catalogKey: entry.key,
            tableId: entry.tableId,
            measure,
            period: latest,
            items: [ra, rb],
            computed: { difference: round(Math.abs(ra.value - rb.value), dec), relativeDifference: round(rel * 100, 1) },
            guards,
            heuristics: { surprise: Math.min(1, rel * 2), recognizability: entry.recognizability / 5, competition: 1, visual: 0.8, dataQuality: 0.9 },
            provenance: prov,
          });
        }
      }

      if (entry.analyses.includes("rank") && ctx.bigCities?.length) {
        const items = ctx.bigCities.map((c) => rows.find((r) => r.code === c)).filter((r): r is FindingItem => Boolean(r)).slice(0, 4);
        const distinct = new Set(items.map((i) => i.value)).size === items.length;
        const minGap = Math.min(...items.flatMap((x, i) => items.slice(i + 1).map((y) => Math.abs(x.value - y.value) / Math.max(Math.abs(x.value), 1e-9))));
        if (items.length === 4 && distinct && minGap >= 0.02) {
          findings.push({
            id: findingId(["rank", entry.key, m.key, latest, items.map((i) => [i.code, i.value])]),
            kind: "rank",
            catalogKey: entry.key,
            tableId: entry.tableId,
            measure,
            period: latest,
            items,
            computed: { minRelativeGap: round(minGap * 100, 1) },
            guards,
            heuristics: { surprise: 0.5, recognizability: entry.recognizability / 5, competition: 0.9, visual: 0.8, dataQuality: 0.9 },
            provenance: prov,
          });
        }
      }

      if (entry.analyses.includes("change") && first !== latest) {
        const changes = rows
          .map((r) => {
            const old = byGeo.get(r.code)?.get(first);
            if (!old || old.value === 0 || old.suppressed) return null;
            return { ...r, from: round(old.value, dec), pct: ((r.value - old.value) / Math.abs(old.value)) * 100 };
          })
          .filter((x): x is FindingItem & { from: number; pct: number } => Boolean(x));
        if (changes.length >= 4) {
          const s = [...changes].sort((a, b) => b.pct - a.pct);
          const top = s[0];
          findings.push({
            id: findingId(["change", entry.key, m.key, first, latest, top.code, top.value]),
            kind: "change",
            catalogKey: entry.key,
            tableId: entry.tableId,
            measure,
            period: latest,
            fromPeriod: first,
            items: [{ code: top.code, label: top.label, value: top.value, base: top.base }],
            computed: { from: top.from, to: top.value, changePct: round(top.pct, 1), changeAbs: round(top.value - top.from, dec) },
            guards,
            heuristics: { surprise: Math.min(1, Math.abs(top.pct) / 40), recognizability: entry.recognizability / 5, competition: 0.7, visual: 0.6, dataQuality: 0.85 },
            provenance: prov,
          });
        }
      }
    }

    // Nasjonale tidsserier
    const national = byGeo.get("*");
    if (national && (entry.analyses.includes("trend") || entry.analyses.includes("stable"))) {
      const series = periods.map((p) => ({ period: p, value: national.get(p)?.value })).filter((x): x is { period: string; value: number } => typeof x.value === "number");
      if (series.length >= 4) {
        const thin = series.length > 12 ? series.filter((_, i) => i % Math.ceil(series.length / 8) === 0 || i === series.length - 1) : series;
        const firstV = thin[0].value;
        const lastV = thin[thin.length - 1].value;
        const rel = firstV !== 0 ? (lastV - firstV) / Math.abs(firstV) : 0;
        const kind: FindingKind = Math.abs(rel) < 0.03 && entry.analyses.includes("stable") ? "stable" : "trend";
        findings.push({
          id: findingId([kind, entry.key, m.key, thin.map((s) => [s.period, s.value])]),
          kind,
          catalogKey: entry.key,
          tableId: entry.tableId,
          measure,
          period: thin[thin.length - 1].period,
          fromPeriod: thin[0].period,
          items: [],
          series: thin.map((s) => ({ period: s.period, value: round(s.value, dec) })),
          computed: { first: round(firstV, dec), last: round(lastV, dec), changePct: round(rel * 100, 1), min: Math.min(...thin.map((s) => s.value)), max: Math.max(...thin.map((s) => s.value)) },
          guards: { smallNumbers: false, suppressed: 0, excludedSmall: 0 },
          heuristics: { surprise: Math.min(1, Math.abs(rel) * 2), recognizability: entry.recognizability / 5, competition: 0.4, visual: 0.9, dataQuality: 0.9 },
          provenance: prov,
        });
      }
    }
  }
  return findings;
}

/** Tall KI-redaksjonen har lov til å bruke i tekst (alt annet avvises av faktakontrollen). */
export function allowedNumbersFor(f: Finding): number[] {
  const nums = [...f.items.map((i) => i.value), ...Object.values(f.computed), ...(f.series ?? []).map((s) => s.value)];
  // Tall som er en del av definisjonen («67 år og eldre», «under 18 år»).
  for (const m of f.measure.label.matchAll(/\d+(?:[.,]\d+)?/g)) nums.push(Number(m[0].replace(",", ".")));
  for (const p of [f.period, f.fromPeriod ?? ""]) {
    const n = parseInt(p, 10);
    if (Number.isFinite(n)) nums.push(n);
  }
  return nums;
}
