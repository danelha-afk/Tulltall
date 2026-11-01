import "server-only";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getDb, type Db } from "./db/client";
import { serverEnv } from "./config/env";
import { ipHash } from "./security/crypto";
import { rateLimit } from "./security/ratelimit";
import { localDate } from "./game/dates";
import { PlayError, type PlayContext } from "./play/service";

export function clientIp(req: Request): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  return req.headers.get("x-real-ip") ?? "0.0.0.0";
}

export function requestIpHash(req: Request): string {
  return ipHash(clientIp(req), serverEnv.sessionSecret, localDate());
}

export async function playContext(req: Request): Promise<PlayContext> {
  return {
    db: await getDb(),
    secret: serverEnv.sessionSecret,
    minAnswerMs: serverEnv.minAnswerMs,
    comparisonMinPlayers: serverEnv.comparisonMinPlayers,
    ipHash: requestIpHash(req),
  };
}

export function jsonError(status: number, code: string, message: string) {
  return NextResponse.json({ error: { code, message } }, { status, headers: { "Cache-Control": "no-store" } });
}

const STATUS: Record<PlayError["code"], number> = {
  not_found: 404,
  forbidden: 403,
  bad_request: 400,
  too_fast: 429,
  out_of_order: 409,
  finished: 409,
  not_finished: 409,
  unavailable: 503,
};

export function handleError(err: unknown) {
  if (err instanceof PlayError) return jsonError(STATUS[err.code], err.code, err.message);
  if (err instanceof z.ZodError) return jsonError(400, "bad_request", "Ugyldig forespørsel");
  console.error("[api]", err);
  return jsonError(500, "internal", "Noe gikk galt på serveren");
}

export async function guardRate(db: Db, req: Request, bucket: string, limit: number, window: number) {
  const res = await rateLimit(db, `${bucket}:${requestIpHash(req)}`, limit, window);
  if (!res.ok) {
    return NextResponse.json(
      { error: { code: "rate_limited", message: "For mange forespørsler – vent litt." } },
      { status: 429, headers: { "Retry-After": String(res.resetSeconds) } },
    );
  }
  return null;
}

export async function readJson<T>(req: Request, schema: z.ZodType<T>, maxBytes = 16_384): Promise<T> {
  const len = Number(req.headers.get("content-length") ?? 0);
  if (len > maxBytes) throw new PlayError("bad_request", "For stor forespørsel");
  const text = await req.text();
  if (text.length > maxBytes) throw new PlayError("bad_request", "For stor forespørsel");
  let data: unknown;
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    throw new PlayError("bad_request", "Ugyldig JSON");
  }
  return schema.parse(data);
}

/** Enkel CSRF-beskyttelse for API-er som endrer tilstand: krev samme opphav når Origin finnes. */
export function sameOrigin(req: Request): boolean {
  const origin = req.headers.get("origin");
  if (!origin) return true; // sendBeacon/eldre klienter – andre kontroller gjelder
  try {
    const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

export const BOT_UA = /bot|crawl|spider|slurp|facebookexternalhit|whatsapp|telegram|discord|preview|embedly|quora|pinterest|vkshare|skype|slack|linkedin/i;
