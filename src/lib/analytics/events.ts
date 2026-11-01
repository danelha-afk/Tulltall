/**
 * Personvernvennlig hendelseslogg. Uten samtykke lagres hendelser uten spiller-ID
 * (rene tellinger). Med samtykke kan gjenbesøk måles med en tilfeldig, anonym ID.
 */
import { z } from "zod";
import type { Db } from "../db/client";

export const EVENT_NAMES = [
  "page_view",
  "game_start",
  "question_answered",
  "game_finish",
  "game_abandon",
  "share_click",
  "share_success",
  "challenge_create",
  "challenge_open",
  "challenge_start",
  "single_open",
  "push_optin",
  "install_prompt",
  "install_accepted",
  "nabokrig_join",
  "reveal_source_open",
  "reveal_deepdive_open",
  "ad_impression",
] as const;
export type EventName = (typeof EVENT_NAMES)[number];

export const EventSchema = z.object({
  name: z.enum(EVENT_NAMES),
  path: z.string().max(200).optional(),
  ref: z.string().max(80).nullish(),
  sessionId: z.string().uuid().nullish(),
  props: z.record(z.string(), z.union([z.string().max(120), z.number(), z.boolean(), z.null()])).optional(),
  variants: z.record(z.string(), z.string().max(20)).optional(),
});
export type EventInput = z.infer<typeof EventSchema>;

export async function recordEvents(db: Db, events: EventInput[], playerId: string | null): Promise<number> {
  if (events.length === 0) return 0;
  await db.query(
    `INSERT INTO events (name, player_id, session_id, path, ref, props, variants)
     SELECT name, $2::uuid, "sessionId"::uuid, path, ref, COALESCE(props, '{}'::jsonb), COALESCE(variants, '{}'::jsonb)
     FROM jsonb_to_recordset($1::jsonb) AS x(name text, "sessionId" text, path text, ref text, props jsonb, variants jsonb)`,
    [JSON.stringify(events.map((e) => ({ ...e, sessionId: e.sessionId ?? null }))), playerId],
  );
  return events.length;
}
