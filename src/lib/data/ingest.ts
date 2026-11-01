/**
 * Innhenting: SSB-tabell → normaliserte, versjonerte observasjoner med revisjonshistorikk.
 *
 * Unngår unødvendige uttrekk: tabellens «updated»-tidspunkt sammenlignes med forrige kjøring,
 * og bare endrede tabeller hentes. Versjoner lagres som delta (nye/endrede celler).
 */
import type { Db } from "../db/client";
import { sha256 } from "../security/crypto";
import type { CatalogEntry } from "./catalog";
import type { SsbClient } from "./ssb/client";
import type { Dimension, ParsedDataset } from "./ssb/jsonstat";
import { resolveSelection } from "./selection";

export type IngestStatus = "skipped" | "unchanged" | "new_version" | "error";

export interface IngestResult {
  key: string;
  datasetId: string;
  status: IngestStatus;
  versionId?: number;
  cells?: number;
  changedCells?: number;
  revisions?: number;
  suppressed?: number;
  missing?: number;
  structureChanged?: boolean;
  sourceUpdated?: string | null;
  error?: string;
  data?: ParsedDataset;
  queryUrl?: string;
}

export function datasetIdFor(entry: CatalogEntry) {
  return `ssb:${entry.tableId}:${entry.key}`;
}

/** Strukturhash over dimensjoner og koder (tidsdimensjonen holdes utenfor fordi den vokser). */
export function structureHash(dims: Dimension[], timeDim: string): string {
  return sha256(
    JSON.stringify(
      dims.map((d) => ({ id: d.id, codes: d.id === timeDim ? [] : [...d.codes].sort() })).sort((a, b) => a.id.localeCompare(b.id)),
    ),
  ).slice(0, 32);
}

export function contentHash(data: ParsedDataset): string {
  const rows = [...data.observations].sort((a, b) => a.key.localeCompare(b.key)).map((o) => `${o.key}=${o.value ?? ""}${o.status ?? ""}`);
  return sha256(rows.join("\n"));
}

async function insertChunked(db: Db, versionId: number, rows: { k: string; v: number | null; s: string | null }[]) {
  const CHUNK = 20_000;
  for (let i = 0; i < rows.length; i += CHUNK) {
    await db.query(
      `INSERT INTO observations (version_id, cell_key, value, status)
       SELECT $1, k, v, s FROM jsonb_to_recordset($2::jsonb) AS x(k text, v double precision, s text)`,
      [versionId, JSON.stringify(rows.slice(i, i + CHUNK))],
    );
  }
}

export async function ingestEntry(
  db: Db,
  client: SsbClient | null,
  entry: CatalogEntry,
  opts: {
    kommuner?: Set<string>;
    force?: boolean;
    /** Brukes kun av tester/demo: ferdig parset metadata og data (merkes som syntetisk). */
    fixture?: { metadata: ParsedDataset; data: ParsedDataset; updated: string; synthetic: true };
  } = {},
): Promise<IngestResult> {
  const datasetId = datasetIdFor(entry);
  const base: IngestResult = { key: entry.key, datasetId, status: "error" };
  try {
    await db.query(
      `INSERT INTO datasets (id, source_id, table_id, title, catalog_key, status) VALUES ($1, 'ssb', $2, $3, $4, 'active')
       ON CONFLICT (id) DO UPDATE SET title = EXCLUDED.title`,
      [datasetId, entry.tableId, entry.title, entry.key],
    );
    const prev = await db.one<{ source_updated_at: Date | null; structure_hash: string | null }>(
      `SELECT source_updated_at, structure_hash FROM datasets WHERE id = $1`,
      [datasetId],
    );

    let updated: string | null;
    let metadata: ParsedDataset;
    if (opts.fixture) {
      updated = opts.fixture.updated;
      metadata = opts.fixture.metadata;
    } else {
      if (!client) throw new Error("SSB-klient mangler");
      const info = await client.getTable(entry.tableId);
      updated = info.updated ?? null;
      if (info.discontinued) {
        await db.query(`UPDATE datasets SET status = 'discontinued', last_checked_at = now() WHERE id = $1`, [datasetId]);
        return { ...base, status: "skipped", error: "Tabellen er avsluttet hos SSB", sourceUpdated: updated };
      }
      if (!opts.force && updated && prev?.source_updated_at && new Date(prev.source_updated_at).getTime() === new Date(updated).getTime()) {
        await db.query(`UPDATE datasets SET last_checked_at = now() WHERE id = $1`, [datasetId]);
        return { ...base, status: "skipped", sourceUpdated: updated };
      }
      metadata = await client.getMetadata(entry.tableId);
    }

    const sHash = structureHash(metadata.dimensions, entry.timeDim);
    const structureChanged = Boolean(prev?.structure_hash && prev.structure_hash !== sHash);
    const selection = resolveSelection(metadata.dimensions, entry.rules, { kommuner: opts.kommuner });

    let data: ParsedDataset;
    let queryUrl: string;
    if (opts.fixture) {
      data = opts.fixture.data;
      queryUrl = `fixture://${entry.tableId}`;
    } else {
      const res = await client!.getData(entry.tableId, selection);
      data = res.data;
      queryUrl = res.urls[0] + (res.urls.length > 1 ? ` (+${res.urls.length - 1} deluttrekk)` : "");
    }

    const hash = contentHash(data);
    const latest = await db.one<{ id: number; content_hash: string }>(
      `SELECT id, content_hash FROM dataset_versions WHERE dataset_id = $1 ORDER BY fetched_at DESC, id DESC LIMIT 1`,
      [datasetId],
    );
    const suppressed = data.observations.filter((o) => o.value === null && o.status === ":").length;
    const missing = data.observations.filter((o) => o.value === null).length;

    if (latest && latest.content_hash === hash) {
      await db.query(
        `UPDATE datasets SET last_checked_at = now(), source_updated_at = $2, structure_hash = $3 WHERE id = $1`,
        [datasetId, updated, sHash],
      );
      return { ...base, status: "unchanged", versionId: latest.id, cells: data.observations.length, suppressed, missing, structureChanged, sourceUpdated: updated, data, queryUrl };
    }

    return await db.tx(async (tx) => {
      const version = await tx.one<{ id: number }>(
        `INSERT INTO dataset_versions (dataset_id, source_updated_at, query_url, content_hash, cell_count, suppressed_count, missing_count, dimensions, units, notes, synthetic)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9::jsonb,$10::jsonb,$11) RETURNING id`,
        [
          datasetId,
          updated,
          queryUrl,
          hash,
          data.observations.length,
          suppressed,
          missing,
          JSON.stringify(data.dimensions.map((d) => ({ id: d.id, label: d.label, n: d.codes.length, codes: d.codes.length <= 60 ? d.codes : undefined }))),
          JSON.stringify(Object.fromEntries(data.dimensions.filter((d) => Object.keys(d.units).length).map((d) => [d.id, d.units]))),
          JSON.stringify(data.notes.slice(0, 20)),
          Boolean(opts.fixture?.synthetic),
        ],
      );
      const versionId = version!.id;

      // Forrige kjente verdi per celle (på tvers av deltaversjoner).
      let previous = new Map<string, number | null>();
      if (latest) {
        const prevRows = await tx.query<{ cell_key: string; value: number | null }>(
          `SELECT DISTINCT ON (o.cell_key) o.cell_key, o.value
           FROM observations o JOIN dataset_versions v ON v.id = o.version_id
           WHERE v.dataset_id = $1 AND o.cell_key = ANY($2::text[])
           ORDER BY o.cell_key, v.fetched_at DESC, v.id DESC`,
          [datasetId, data.observations.map((o) => o.key)],
        );
        previous = new Map(prevRows.map((r) => [r.cell_key, r.value]));
      }
      const changed = data.observations.filter((o) => !previous.has(o.key) || previous.get(o.key) !== o.value);
      await insertChunked(
        tx,
        versionId,
        changed.map((o) => ({ k: o.key, v: o.value, s: o.status })),
      );
      const revisions = changed.filter((o) => previous.has(o.key));
      if (revisions.length) {
        await tx.query(
          `INSERT INTO observation_revisions (dataset_id, cell_key, old_value, new_value, from_version, to_version)
           SELECT $1, k, ov, nv, $2, $3 FROM jsonb_to_recordset($4::jsonb) AS x(k text, ov double precision, nv double precision)`,
          [datasetId, latest!.id, versionId, JSON.stringify(revisions.map((o) => ({ k: o.key, ov: previous.get(o.key), nv: o.value })))],
        );
      }
      await tx.query(
        `UPDATE datasets SET source_updated_at = $2, last_checked_at = now(), last_fetched_at = now(), structure_hash = $3,
           metadata = $4::jsonb, status = 'active' WHERE id = $1`,
        [datasetId, updated, sHash, JSON.stringify({ label: data.label, selection: Object.fromEntries(Object.entries(selection).map(([k, v]) => [k, v.length])) })],
      );
      return {
        ...base,
        status: "new_version" as const,
        versionId,
        cells: data.observations.length,
        changedCells: changed.length,
        revisions: revisions.length,
        suppressed,
        missing,
        structureChanged,
        sourceUpdated: updated,
        data,
        queryUrl,
      };
    });
  } catch (err) {
    await db
      .query(`UPDATE datasets SET status = 'error', last_checked_at = now() WHERE id = $1`, [datasetId])
      .catch(() => undefined);
    return { ...base, status: "error", error: (err as Error).message };
  }
}
