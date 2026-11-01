import { createHash, createHmac, randomBytes, randomUUID, timingSafeEqual } from "node:crypto";

export function sha256(input: string): string {
  return createHash("sha256").update(input).digest("hex");
}

export function hmac(secret: string, input: string): string {
  return createHmac("sha256", secret).update(input).digest("base64url");
}

export function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

export function newId(): string {
  return randomUUID();
}

const ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789"; // uten forvekslbare tegn

/** Kort, lesbar kode for utfordringslenker, f.eks. "k7m2xq". */
export function shortCode(length = 6): string {
  const bytes = randomBytes(length);
  let out = "";
  for (let i = 0; i < length; i++) out += ALPHABET[bytes[i] % ALPHABET.length];
  return out;
}

export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Personvernvennlig IP-hash: saltet med hemmelighet + dato, slik at den ikke kan
 * kobles på tvers av dager eller reverseres. Brukes bare til misbruksbegrensning.
 */
export function ipHash(ip: string, secret: string, date: string): string {
  return sha256(`${secret}:${date}:${ip}`).slice(0, 24);
}
