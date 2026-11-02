/**
 * Gjenopprettingskode: en kode du kan ta vare på for å få profilen din tilbake på en ny telefon,
 * etter at nettleseren er tømt, eller når appen bytter adresse. Bare en hash av koden lagres.
 */
import type { Db } from "../db/client";
import { shortCode, sha256 } from "../security/crypto";

const LENGTH = 12;

/** Små bokstaver og tall; alt annet (bindestrek, mellomrom) ignoreres. */
export function normalizeCode(input: string): string {
  return input.toLowerCase().replace(/[^a-z0-9]/g, "");
}

export function formatCode(raw: string): string {
  return (normalizeCode(raw).match(/.{1,4}/g) ?? []).join("-");
}

const hashOf = (code: string) => sha256(`recovery:${normalizeCode(code)}`);

/** Lager en ny kode (en eventuell gammel kode slutter å virke). Vises bare én gang. */
export async function createRecoveryCode(db: Db, playerId: string): Promise<string> {
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = shortCode(LENGTH);
    try {
      const res = await db.query(`UPDATE players SET recovery_hash = $2 WHERE id = $1 RETURNING id`, [playerId, hashOf(code)]);
      if (res.length) return formatCode(code);
      throw new Error("Ukjent spiller");
    } catch (err) {
      if (/unique|duplicate/i.test((err as Error).message)) continue;
      throw err;
    }
  }
  throw new Error("Kunne ikke lage kode");
}

/** Finn spilleren som hører til koden, eller null. */
export async function restoreByCode(db: Db, code: string): Promise<string | null> {
  const n = normalizeCode(code);
  if (n.length !== LENGTH) return null;
  const row = await db.one<{ id: string }>(`SELECT id FROM players WHERE recovery_hash = $1`, [hashOf(n)]);
  if (!row) return null;
  await db.query(`UPDATE players SET last_seen_at = now() WHERE id = $1`, [row.id]);
  return row.id;
}
