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
  const ssl =
    process.env.PGSSL === "disable"
      ? undefined
      : process.env.PGSSL === "no-verify"
        ? { rejectUnauthorized: false }
        : connectionString.includes("localhost") || connectionString.includes("127.0.0.1")
          ? undefined
          : { rejectUnauthorized: true };
  const pool = new pgLib.Pool({
    connectionString,
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

export async function runMigrations(db: Db): Promise<string[]> {
  await db.exec(`CREATE TABLE IF NOT EXISTS schema_migrations (id text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())`);
  const done = new Set((await db.query<{ id: string }>(`SELECT id FROM schema_migrations`)).map((r) => r.id));
  const applied: string[] = [];
  for (const m of migrations) {
    if (done.has(m.id)) continue;
    await db.tx(async (tx) => {
      await tx.exec(m.sql);
      await tx.query(`INSERT INTO schema_migrations (id) VALUES ($1)`, [m.id]);
    });
    applied.push(m.id);
  }
  return applied;
}

type GlobalWithDb = typeof globalThis & { __tulltallDb?: Promise<Db> };

/**
 * Felles databaseforbindelse for prosessen.
 * - DATABASE_URL satt → PostgreSQL (produksjon/Supabase).
 * - Ellers → PGlite i `PGLITE_DIR` (standard `.data/pglite`), med automatisk migrering og seed.
 */
export function getDb(): Promise<Db> {
  const g = globalThis as GlobalWithDb;
  if (!g.__tulltallDb) {
    g.__tulltallDb = (async () => {
      const url = process.env.DATABASE_URL;
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
