/**
 * Klient for SSBs PxWebApi v2 (https://data.ssb.no/api/pxwebapi/v2).
 *
 * - Henter dokumenterte grenser fra /config (maks dataceller per uttrekk og kall per tidsvindu)
 *   og tilpasser seg dynamisk. Standard: 800 000 celler og 30 kall per 60 sekunder.
 * - Glidende vindu for kall, respekterer Retry-After ved 429, eksponentiell backoff ved 5xx/nettfeil.
 * - Deler store uttrekk automatisk i biter under cellegrensen.
 * - Hurtigbuffer per kjøring, så samme URL aldri hentes to ganger.
 */
import { parseJsonStat, type JsonStatDataset, type ParsedDataset } from "./jsonstat";

export interface SsbConfig {
  maxDataCells: number;
  maxCallsPerTimeWindow: number;
  timeWindow: number;
}

export interface TableInfo {
  id: string;
  label: string;
  updated: string | null;
  firstPeriod?: string;
  lastPeriod?: string;
  variableNames?: string[];
  discontinued?: boolean;
  timeUnit?: string;
  subjectCode?: string;
}

export type FetchLike = (url: string, init?: { signal?: AbortSignal; headers?: Record<string, string> }) => Promise<{
  ok: boolean;
  status: number;
  headers: { get(name: string): string | null };
  json(): Promise<unknown>;
  text(): Promise<string>;
}>;

export interface SsbClientOptions {
  baseUrl?: string;
  lang?: "no" | "en";
  fetch?: FetchLike;
  sleep?: (ms: number) => Promise<void>;
  now?: () => number;
  log?: (msg: string) => void;
  maxRetries?: number;
  timeoutMs?: number;
}

export class SsbError extends Error {
  constructor(
    message: string,
    public status: number,
    public url: string,
  ) {
    super(message);
  }
}

const DEFAULT_CONFIG: SsbConfig = { maxDataCells: 800_000, maxCallsPerTimeWindow: 30, timeWindow: 60 };

export class SsbClient {
  readonly baseUrl: string;
  readonly lang: "no" | "en";
  private fetchImpl: FetchLike;
  private sleep: (ms: number) => Promise<void>;
  private now: () => number;
  private log: (msg: string) => void;
  private maxRetries: number;
  private timeoutMs: number;
  private calls: number[] = [];
  private cache = new Map<string, unknown>();
  config: SsbConfig = { ...DEFAULT_CONFIG };
  private configLoaded = false;
  stats = { requests: 0, cacheHits: 0, retries: 0, throttled: 0 };

  constructor(opts: SsbClientOptions = {}) {
    this.baseUrl = (opts.baseUrl ?? process.env.SSB_API_BASE ?? "https://data.ssb.no/api/pxwebapi/v2").replace(/\/$/, "");
    this.lang = opts.lang ?? "no";
    this.fetchImpl = opts.fetch ?? ((url, init) => fetch(url, init) as ReturnType<FetchLike>);
    this.sleep = opts.sleep ?? ((ms) => new Promise((r) => setTimeout(r, ms)));
    this.now = opts.now ?? (() => Date.now());
    this.log = opts.log ?? (() => undefined);
    this.maxRetries = opts.maxRetries ?? 4;
    this.timeoutMs = opts.timeoutMs ?? 60_000;
  }

  /** Venter til et nytt kall er innenfor grensen (glidende vindu, litt sikkerhetsmargin). */
  private async throttle() {
    const windowMs = this.config.timeWindow * 1000;
    const limit = Math.max(1, this.config.maxCallsPerTimeWindow - 2);
    for (;;) {
      const t = this.now();
      this.calls = this.calls.filter((c) => t - c < windowMs);
      if (this.calls.length < limit) {
        this.calls.push(t);
        return;
      }
      const wait = windowMs - (t - this.calls[0]) + 50;
      this.stats.throttled++;
      await this.sleep(wait);
    }
  }

  async getJson<T>(path: string, params: Record<string, string> = {}): Promise<T> {
    const url = this.url(path, params);
    if (this.cache.has(url)) {
      this.stats.cacheHits++;
      return this.cache.get(url) as T;
    }
    let attempt = 0;
    for (;;) {
      await this.throttle();
      this.stats.requests++;
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), this.timeoutMs);
      try {
        const res = await this.fetchImpl(url, { signal: ctrl.signal, headers: { Accept: "application/json" } });
        if (res.ok) {
          const data = (await res.json()) as T;
          this.cache.set(url, data);
          return data;
        }
        if (res.status === 429 || res.status >= 500) {
          if (attempt >= this.maxRetries) throw new SsbError(`SSB svarte ${res.status}`, res.status, url);
          const retryAfter = Number(res.headers.get("retry-after"));
          const wait = res.status === 429 ? (Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : this.config.timeWindow * 1000) : 1000 * 2 ** attempt;
          this.log(`SSB ${res.status} – venter ${Math.round(wait / 1000)} s (forsøk ${attempt + 1})`);
          this.stats.retries++;
          attempt++;
          await this.sleep(wait);
          continue;
        }
        const body = await res.text().catch(() => "");
        throw new SsbError(`SSB svarte ${res.status}: ${body.slice(0, 300)}`, res.status, url);
      } catch (err) {
        if (err instanceof SsbError) throw err;
        if (attempt >= this.maxRetries) throw new SsbError(`Nettverksfeil mot SSB: ${(err as Error).message}`, 0, url);
        this.stats.retries++;
        await this.sleep(1000 * 2 ** attempt);
        attempt++;
      } finally {
        clearTimeout(timer);
      }
    }
  }

  url(path: string, params: Record<string, string> = {}): string {
    const qs = new URLSearchParams({ lang: this.lang, ...params });
    return `${this.baseUrl}${path}?${qs.toString().replace(/%5B/g, "[").replace(/%5D/g, "]").replace(/%2C/g, ",")}`;
  }

  /** Leser API-ets egne grenser. Faller tilbake til dokumenterte standardverdier. */
  async loadConfig(): Promise<SsbConfig> {
    if (this.configLoaded) return this.config;
    try {
      const c = await this.getJson<Partial<SsbConfig>>("/config");
      this.config = {
        maxDataCells: Number(c.maxDataCells) > 0 ? Number(c.maxDataCells) : DEFAULT_CONFIG.maxDataCells,
        maxCallsPerTimeWindow: Number(c.maxCallsPerTimeWindow) > 0 ? Number(c.maxCallsPerTimeWindow) : DEFAULT_CONFIG.maxCallsPerTimeWindow,
        timeWindow: Number(c.timeWindow) > 0 ? Number(c.timeWindow) : DEFAULT_CONFIG.timeWindow,
      };
    } catch (err) {
      this.log(`Kunne ikke lese /config (${(err as Error).message}) – bruker standardgrenser`);
    }
    this.configLoaded = true;
    return this.config;
  }

  /** Tabeller oppdatert de siste `pastDays` dagene (paginert). */
  async listTables(opts: { pastDays?: number; query?: string; pageSize?: number; maxPages?: number } = {}): Promise<TableInfo[]> {
    const out: TableInfo[] = [];
    const pageSize = opts.pageSize ?? 500;
    for (let page = 1; page <= (opts.maxPages ?? 20); page++) {
      const params: Record<string, string> = { pageNumber: String(page), pageSize: String(pageSize) };
      if (opts.pastDays) params.pastDays = String(opts.pastDays);
      if (opts.query) params.query = opts.query;
      const res = await this.getJson<{ tables: TableInfo[]; page?: { totalPages?: number } }>("/tables", params);
      out.push(...(res.tables ?? []));
      const totalPages = res.page?.totalPages ?? 1;
      if (page >= totalPages) break;
    }
    return out;
  }

  async getTable(id: string): Promise<TableInfo> {
    return this.getJson<TableInfo>(`/tables/${encodeURIComponent(id)}`);
  }

  async getMetadata(id: string): Promise<ParsedDataset> {
    const ds = await this.getJson<JsonStatDataset>(`/tables/${encodeURIComponent(id)}/metadata`, { outputFormat: "json-stat2" });
    return parseJsonStat(ds);
  }

  /** Bygger uttrekks-URL for et utvalg (dimensjon → koder). */
  dataUrl(id: string, selection: Record<string, string[]>): string {
    const params: Record<string, string> = { outputFormat: "json-stat2" };
    for (const [dim, codes] of Object.entries(selection)) params[`valueCodes[${dim}]`] = codes.join(",");
    return this.url(`/tables/${encodeURIComponent(id)}/data`, params);
  }

  /**
   * Henter data for et utvalg. Store uttrekk deles automatisk på den største dimensjonen slik at
   * hvert kall holder seg under cellegrensen.
   */
  async getData(id: string, selection: Record<string, string[]>): Promise<{ data: ParsedDataset; urls: string[] }> {
    await this.loadConfig();
    const chunks = splitSelection(selection, Math.floor(this.config.maxDataCells * 0.9));
    const parts: ParsedDataset[] = [];
    const urls: string[] = [];
    for (const sel of chunks) {
      const params: Record<string, string> = { outputFormat: "json-stat2" };
      for (const [dim, codes] of Object.entries(sel)) params[`valueCodes[${dim}]`] = codes.join(",");
      urls.push(this.url(`/tables/${encodeURIComponent(id)}/data`, params));
      const ds = await this.getJson<JsonStatDataset>(`/tables/${encodeURIComponent(id)}/data`, params);
      parts.push(parseJsonStat(ds));
    }
    return { data: mergeParsed(parts), urls };
  }
}

export function cellCount(selection: Record<string, string[]>): number {
  return Object.values(selection).reduce((n, codes) => n * Math.max(1, codes.length), 1);
}

/** Deler et utvalg i biter med høyst `maxCells` celler ved å kutte i den største dimensjonen. */
export function splitSelection(selection: Record<string, string[]>, maxCells: number): Record<string, string[]>[] {
  if (cellCount(selection) <= maxCells) return [selection];
  const [dim, codes] = Object.entries(selection).sort((a, b) => b[1].length - a[1].length)[0];
  if (codes.length <= 1) throw new Error("Utvalget kan ikke deles mer og er fortsatt over cellegrensen");
  const mid = Math.ceil(codes.length / 2);
  return [
    ...splitSelection({ ...selection, [dim]: codes.slice(0, mid) }, maxCells),
    ...splitSelection({ ...selection, [dim]: codes.slice(mid) }, maxCells),
  ];
}

export function mergeParsed(parts: ParsedDataset[]): ParsedDataset {
  if (parts.length === 1) return parts[0];
  const first = parts[0];
  const dims = first.dimensions.map((d) => {
    const codes: string[] = [];
    const labels: Record<string, string> = {};
    for (const p of parts) {
      const pd = p.dimensions.find((x) => x.id === d.id)!;
      for (const c of pd.codes) if (!labels[c]) {
        codes.push(c);
        labels[c] = pd.labels[c];
      }
    }
    return { ...d, codes, labels };
  });
  const seen = new Set<string>();
  const observations = parts.flatMap((p) => p.observations).filter((o) => (seen.has(o.key) ? false : (seen.add(o.key), true)));
  return { ...first, dimensions: dims, observations };
}
