import { describe, expect, it } from "vitest";
import { SsbClient, splitSelection, cellCount, type FetchLike } from "@/lib/data/ssb/client";
import { parseJsonStat, cellKey, type JsonStatDataset } from "@/lib/data/ssb/jsonstat";
import { resolveSelection, SelectionError } from "@/lib/data/selection";

/** Liten JSON-stat 2.0-fikstur i SSBs format. Verdiene er syntetiske. */
const tiny: JsonStatDataset = {
  version: "2.0",
  class: "dataset",
  label: "Syntetisk testtabell",
  updated: "2026-01-01T00:00:00Z",
  id: ["Region", "ContentsCode", "Tid"],
  size: [2, 1, 3],
  dimension: {
    Region: { label: "region", category: { index: { "0301": 0, "4601": 1 }, label: { "0301": "Oslo", "4601": "Bergen" } } },
    ContentsCode: { label: "statistikkvariabel", category: { index: ["Personer1"], label: { Personer1: "Personer" } } },
    Tid: { label: "år", category: { index: { "2024": 0, "2025": 1, "2026": 2 }, label: { "2024": "2024", "2025": "2025", "2026": "2026" } } },
  },
  value: [1, 2, null, 4, 5, 6],
  status: { "2": ":" },
  role: { time: ["Tid"], geo: ["Region"], metric: ["ContentsCode"] },
};

function fakeFetch(handler: (url: string, n: number) => { status: number; body?: unknown; headers?: Record<string, string> }): FetchLike & { calls: string[] } {
  const calls: string[] = [];
  const f = (async (url: string) => {
    calls.push(url);
    const r = handler(url, calls.length);
    return {
      ok: r.status >= 200 && r.status < 300,
      status: r.status,
      headers: { get: (k: string) => r.headers?.[k.toLowerCase()] ?? null },
      json: async () => r.body,
      text: async () => JSON.stringify(r.body ?? ""),
    };
  }) as FetchLike & { calls: string[] };
  f.calls = calls;
  return f;
}

describe("JSON-stat 2.0", () => {
  it("leser verdier i rad-major-rekkefølge, inkludert skjermede verdier", () => {
    const p = parseJsonStat(tiny);
    expect(p.observations).toHaveLength(6);
    const v = (r: string, t: string) => p.observations.find((o) => o.dims.Region === r && o.dims.Tid === t)!;
    expect(v("0301", "2024").value).toBe(1);
    expect(v("0301", "2026").value).toBeNull();
    expect(v("0301", "2026").status).toBe(":");
    expect(v("4601", "2026").value).toBe(6);
    expect(p.roles).toEqual({ time: "Tid", geo: "Region", metric: "ContentsCode" });
    expect(cellKey({ Tid: "2024", Region: "0301" })).toBe("Region=0301|Tid=2024");
  });

  it("avviser ødelagte datasett", () => {
    expect(() => parseJsonStat({ ...tiny, size: [3, 1, 3] })).toThrow();
  });
});

describe("utvalgsregler", () => {
  const dims = parseJsonStat(tiny).dimensions;
  it("løser opp regler mot metadata", () => {
    const sel = resolveSelection(dims, { Region: { kind: "codes", codes: ["4601"] }, Tid: { kind: "last", n: 2 } });
    expect(sel).toEqual({ Region: ["4601"], ContentsCode: ["Personer1"], Tid: ["2025", "2026"] });
  });
  it("oppdager forsvunne koder og dimensjoner (endret tabellstruktur)", () => {
    expect(() => resolveSelection(dims, { Region: { kind: "codes", codes: ["9999"] } })).toThrow(SelectionError);
    expect(() => resolveSelection(dims, { Kjonn: { kind: "all" } })).toThrow(SelectionError);
  });
});

describe("SSB-klient", () => {
  const sleeps: number[] = [];
  let now = 0;
  const base = { sleep: async (ms: number) => void (sleeps.push(ms), (now += ms)), now: () => now };

  it("leser grenser fra /config og bygger korrekte uttrekks-URL-er", async () => {
    const f = fakeFetch((url) => (url.includes("/config") ? { status: 200, body: { maxDataCells: 100, maxCallsPerTimeWindow: 5, timeWindow: 10 } } : { status: 200, body: tiny }));
    const c = new SsbClient({ fetch: f, ...base, baseUrl: "https://example.test/v2" });
    await c.loadConfig();
    expect(c.config).toEqual({ maxDataCells: 100, maxCallsPerTimeWindow: 5, timeWindow: 10 });
    const { data, urls } = await c.getData("07459", { Region: ["0301", "4601"], Tid: ["2024"] });
    expect(urls[0]).toContain("/tables/07459/data?lang=no&outputFormat=json-stat2&valueCodes[Region]=0301,4601&valueCodes[Tid]=2024");
    expect(data.observations.length).toBe(6);
  });

  it("respekterer kall per tidsvindu (glidende vindu)", async () => {
    sleeps.length = 0;
    const f = fakeFetch((url) => (url.includes("/config") ? { status: 200, body: { maxDataCells: 1000, maxCallsPerTimeWindow: 4, timeWindow: 10 } } : { status: 200, body: { tables: [] } }));
    const c = new SsbClient({ fetch: f, ...base });
    await c.loadConfig();
    for (let i = 0; i < 6; i++) await c.getJson(`/tables`, { q: String(i) });
    expect(c.stats.throttled).toBeGreaterThan(0);
    expect(sleeps.some((s) => s >= 9000)).toBe(true);
  });

  it("venter ved 429 (Retry-After) og prøver igjen ved 5xx", async () => {
    sleeps.length = 0;
    let n = 0;
    const f = fakeFetch(() => {
      n++;
      if (n === 1) return { status: 429, headers: { "retry-after": "7" } };
      if (n === 2) return { status: 503 };
      return { status: 200, body: { ok: true } };
    });
    const c = new SsbClient({ fetch: f, ...base });
    const res = await c.getJson<{ ok: boolean }>("/tables/x");
    expect(res.ok).toBe(true);
    expect(sleeps).toContain(7000);
    expect(c.stats.retries).toBe(2);
  });

  it("gir opp etter maks antall forsøk", async () => {
    const f = fakeFetch(() => ({ status: 500 }));
    const c = new SsbClient({ fetch: f, ...base, maxRetries: 2 });
    await expect(c.getJson("/tables/y")).rejects.toThrow(/500/);
    expect(f.calls.length).toBe(3);
  });

  it("henter ikke samme URL to ganger i samme kjøring", async () => {
    const f = fakeFetch(() => ({ status: 200, body: { a: 1 } }));
    const c = new SsbClient({ fetch: f, ...base });
    await c.getJson("/tables/z");
    await c.getJson("/tables/z");
    expect(f.calls.length).toBe(1);
    expect(c.stats.cacheHits).toBe(1);
  });

  it("deler uttrekk over cellegrensen", () => {
    const sel = { Region: Array.from({ length: 357 }, (_, i) => String(i)), Alder: Array.from({ length: 106 }, (_, i) => String(i)), Tid: ["2024", "2025"] };
    expect(cellCount(sel)).toBe(357 * 106 * 2);
    const parts = splitSelection(sel, 20_000);
    expect(parts.every((p) => cellCount(p) <= 20_000)).toBe(true);
    expect(parts.reduce((s, p) => s + cellCount(p), 0)).toBe(cellCount(sel));
  });
});
