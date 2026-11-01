/**
 * Parser for JSON-stat 2.0 – standardformatet fra SSBs PxWebApi v2.
 * Verdiene ligger flatt i rad-major-rekkefølge (siste dimensjon varierer raskest).
 */
export interface JsonStatDimension {
  label?: string;
  category: {
    index?: Record<string, number> | string[];
    label?: Record<string, string>;
    unit?: Record<string, { base?: string; decimals?: number; label?: string }>;
  };
  extension?: Record<string, unknown>;
}

export interface JsonStatDataset {
  version?: string;
  class?: string;
  label?: string;
  source?: string;
  updated?: string;
  id: string[];
  size: number[];
  dimension: Record<string, JsonStatDimension>;
  value?: (number | null)[] | Record<string, number | null>;
  status?: (string | null)[] | Record<string, string> | string;
  role?: { time?: string[]; geo?: string[]; metric?: string[] };
  note?: string[];
  extension?: Record<string, unknown>;
}

export interface Dimension {
  id: string;
  label: string;
  codes: string[];
  labels: Record<string, string>;
  units: Record<string, { base?: string; decimals?: number }>;
}

export interface Observation {
  key: string;
  dims: Record<string, string>;
  value: number | null;
  status: string | null;
}

export interface ParsedDataset {
  label: string;
  updated: string | null;
  source: string | null;
  dimensions: Dimension[];
  roles: { time?: string; geo?: string; metric?: string };
  observations: Observation[];
  notes: string[];
}

export function orderedCodes(cat: JsonStatDimension["category"]): string[] {
  const idx = cat.index;
  if (Array.isArray(idx)) return [...idx];
  if (idx && typeof idx === "object") return Object.entries(idx).sort((a, b) => a[1] - b[1]).map(([c]) => c);
  // Ett enkelt kategori-element uten index
  return Object.keys(cat.label ?? {});
}

export function cellKey(dims: Record<string, string>): string {
  return Object.keys(dims)
    .sort()
    .map((k) => `${k}=${dims[k]}`)
    .join("|");
}

export function parseJsonStat(ds: JsonStatDataset): ParsedDataset {
  if (!ds || !Array.isArray(ds.id) || !Array.isArray(ds.size) || ds.id.length !== ds.size.length) {
    throw new Error("Ugyldig JSON-stat: mangler id/size");
  }
  const dimensions: Dimension[] = ds.id.map((id) => {
    const d = ds.dimension[id];
    if (!d) throw new Error(`Ugyldig JSON-stat: mangler dimensjon ${id}`);
    const codes = orderedCodes(d.category);
    return {
      id,
      label: d.label ?? id,
      codes,
      labels: Object.fromEntries(codes.map((c) => [c, d.category.label?.[c] ?? c])),
      units: d.category.unit ?? {},
    };
  });
  dimensions.forEach((d, i) => {
    if (d.codes.length !== ds.size[i]) throw new Error(`Ugyldig JSON-stat: størrelse stemmer ikke for ${d.id}`);
  });
  const total = ds.size.reduce((a, b) => a * b, 1);
  const valueAt = (i: number): number | null => {
    if (!ds.value) return null;
    const v = Array.isArray(ds.value) ? ds.value[i] : ds.value[String(i)];
    return v === undefined || v === null || Number.isNaN(v) ? null : Number(v);
  };
  const statusAt = (i: number): string | null => {
    if (!ds.status) return null;
    if (typeof ds.status === "string") return ds.status;
    const s = Array.isArray(ds.status) ? ds.status[i] : ds.status[String(i)];
    return s ?? null;
  };
  const observations: Observation[] = [];
  if (ds.value !== undefined) {
    const strides = ds.size.map((_, i) => ds.size.slice(i + 1).reduce((a, b) => a * b, 1));
    for (let i = 0; i < total; i++) {
      const dims: Record<string, string> = {};
      dimensions.forEach((d, k) => {
        dims[d.id] = d.codes[Math.floor(i / strides[k]) % ds.size[k]];
      });
      observations.push({ key: cellKey(dims), dims, value: valueAt(i), status: statusAt(i) });
    }
  }
  return {
    label: ds.label ?? "",
    updated: ds.updated ?? null,
    source: ds.source ?? null,
    dimensions,
    roles: { time: ds.role?.time?.[0], geo: ds.role?.geo?.[0], metric: ds.role?.metric?.[0] },
    observations,
    notes: ds.note ?? [],
  };
}

/** SSB-symboler for manglende verdier. */
export const STATUS_MEANING: Record<string, string> = {
  ".": "Ikke mulig å oppgi tall / ikke aktuelt",
  "..": "Tall foreligger ikke",
  "...": "Oppgave mangler",
  ":": "Vises ikke av konfidensialitetshensyn",
  "-": "Null",
};
