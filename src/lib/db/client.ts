/**
 * Tynt databaselag som fungerer likt mot PostgreSQL (Supabase/produksjon) og PGlite
 * (Postgres kompilert til WebAssembly – brukes lokalt og i tester, ingen installasjon nødvendig).
 */
import { migrations } from "./migrations";

export interface Db {
  readonly kind: "pglite" | "postgres";
  query<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<T[]>;
  one<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<T | undefined>;
  exec(sql: string): Promise<void>;
  tx<T>(fn: (db: Db) => Promise<T>): Promise<T>;
  close(): Promise<void>;
}

type Queryable = {
  query: (sql: string, params?: unknown[]) => Promise<{ rows: unknown[] }>;
  exec?: (sql: string) => Promise<unknown>;
};

function wrap(kind: Db["kind"], q: Queryable, txImpl: Db["tx"], close: () => Promise<void>): Db {
  const db: Db = {
    kind,
    async query<T>(sql: string, params: unknown[] = []) {
      const res = await q.query(sql, params);
      return res.rows as T[];
    },
    async one<T>(sql: string, params: unknown[] = []) {
      const res = await q.query(sql, params);
      return res.rows[0] as T | undefined;
    },
    async exec(sql: string) {
      if (q.exec) await q.exec(sql);
      else await q.query(sql);
    },
    tx: txImpl,
    close,
  };
  return db;
}

const numberParsers = {
  20: (v: string) => Number(v), // int8 / bigserial
  1700: (v: string) => Number(v), // numeric
};

export async function createPgliteDb(dataDir?: string): Promise<Db> {
  const { PGlite } = await import("@electric-sql/pglite");
  if (dataDir && !dataDir.includes("://")) {
    const { mkdirSync } = await import("node:fs");
    mkdirSync(dataDir, { recursive: true });
  }
  const pg = new PGlite(dataDir, { parsers: numberParsers });
  await pg.waitReady;
  const make = (conn: Queryable, isRoot: boolean): Db =>
    wrap(
      "pglite",
      conn,
      async (fn) => {
        if (!isRoot) return fn(make(conn, false));
        return pg.transaction(async (tx) => fn(make(tx as unknown as Queryable, false)));
      },
      async () => {
        if (isRoot) await pg.close();
      },
    );
  return make(pg as unknown as Queryable, true);
}

export async function createPostgresDb(connectionString: string): Promise<Db> {
  const pgMod = await import("pg");
  const pgLib = (pgMod as unknown as { default?: typeof pgMod }).default ?? pgMod;
  pgLib.types.setTypeParser(20, numberParsers[20]);
  pgLib.types.setTypeParser(1700, numberParsers[1700]);
  // sslmode i URL-en ville overstyrt innstillingene under (node-postgres tolker «require» som full
  // sertifikatverifisering, som feiler mot Supabase sin egen CA). Vi styrer TLS eksplisitt i stedet.
  const parsed = new URL(connectionString);
  parsed.searchParams.delete("sslmode");
  const local = ["localhost", "127.0.0.1", "::1"].includes(parsed.hostname);
  const ssl =
    process.env.PGSSL === "disable" || local
      ? undefined
      : process.env.PGSSL_CA
        ? { ca: process.env.PGSSL_CA.replace(/\\n/g, "\n"), rejectUnauthorized: true }
        : process.env.PGSSL === "verify"
          ? { rejectUnauthorized: true }
          : // Kryptert forbindelse uten CA-verifisering (standard for Supabase uten PGSSL_CA).
            { rejectUnauthorized: false };
  const pool = new pgLib.Pool({
    connectionString: parsed.toString(),
    max: Number(process.env.PG_POOL_MAX ?? 5),
    idleTimeoutMillis: 10_000,
    ssl,
  });
  const make = (conn: Queryable, isRoot: boolean): Db =>
    wrap(
      "postgres",
      conn,
      async (fn) => {
        if (!isRoot) return fn(make(conn, false));
        const client = await pool.connect();
        try {
          await client.query("BEGIN");
          const result = await fn(make(client as unknown as Queryable, false));
          await client.query("COMMIT");
          return result;
        } catch (err) {
          await client.query("ROLLBACK").catch(() => undefined);
          throw err;
        } finally {
          client.release();
        }
      },
      async () => {
        if (isRoot) await pool.end();
      },
    );
  return make(pool as unknown as Queryable, true);
}

/** Lås som hindrer at flere serverinstanser migrerer/seeder samtidig (f.eks. første oppstart på Vercel). */
export const MIGRATION_LOCK = 727_274_001;

export async function runMigrations(db: Db): Promise<string[]> {
  await db.exec(`CREATE TABLE IF NOT EXISTS schema_migrations (id text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())`);
  return db.tx(async (tx) => {
    await tx.query(`SELECT pg_advisory_xact_lock($1)`, [MIGRATION_LOCK]);
    const done = new Set((await tx.query<{ id: string }>(`SELECT id FROM schema_migrations`)).map((r) => r.id));
    const applied: string[] = [];
    for (const m of migrations) {
      if (done.has(m.id)) continue;
      await tx.exec(m.sql);
      await tx.query(`INSERT INTO schema_migrations (id) VALUES ($1)`, [m.id]);
      applied.push(m.id);
    }
    return applied;
  });
}

/** Tilkoblingsstreng: DATABASE_URL, eller POSTGRES_URL som Vercels Supabase-integrasjon setter automatisk. */
export function databaseUrl(): string | undefined {
  const raw = process.env.DATABASE_URL || process.env.POSTGRES_URL;
  // Usynlige mellomrom/linjeskift fra innliming ødelegger passordet – fjern dem.
  return raw ? raw.replace(/\s+/g, "") || undefined : undefined;
}

type GlobalWithDb = typeof globalThis & { __tulltallDb?: Promise<Db> };

/**
 * Felles databaseforbindelse for prosessen.
 * - DATABASE_URL (eller POSTGRES_URL) satt → PostgreSQL (produksjon/Supabase).
 * - Ellers → PGlite i `PGLITE_DIR` (standard `.data/pglite`), med automatisk migrering og seed.
 */
export function getDb(): Promise<Db> {
  const g = globalThis as GlobalWithDb;
  if (!g.__tulltallDb) {
    g.__tulltallDb = (async () => {
      const url = databaseUrl();
      const db = url ? await createPostgresDb(url) : await createPgliteDb(process.env.PGLITE_DIR ?? ".data/pglite");
      const autoMigrate = !url || process.env.AUTO_MIGRATE === "true";
      if (autoMigrate) {
        await runMigrations(db);
        const { seedIfEmpty } = await import("./seed");
        await seedIfEmpty(db);
      }
      return db;
    })().catch((err) => {
      (globalThis as GlobalWithDb).__tulltallDb = undefined;
      throw err;
    });
  }
  return g.__tulltallDb;
}

/** For tester: ny, isolert minnedatabase med migrasjoner og seed. */
export async function createTestDb(options: { seed?: boolean } = {}): Promise<Db> {
  const db = await createPgliteDb();
  await runMigrations(db);
  if (options.seed !== false) {
    const { seedIfEmpty } = await import("./seed");
    await seedIfEmpty(db);
  }
  return db;
}

export const json = (v: unknown) => JSON.stringify(v);
