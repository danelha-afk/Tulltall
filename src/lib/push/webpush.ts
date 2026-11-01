/**
 * Web Push (VAPID). Brukes bare når spilleren aktivt har bedt om varsel.
 * Nøkler genereres med `npm run vapid` og legges i miljøvariabler.
 */
import type { Db } from "../db/client";

export interface PushPayload {
  title: string;
  body: string;
  url: string;
  tag?: string;
}

export function pushConfigured(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY);
}

export async function sendDailyPush(db: Db, payload: PushPayload, limit = 5000): Promise<{ sent: number; removed: number; failed: number }> {
  if (!pushConfigured()) return { sent: 0, removed: 0, failed: 0 };
  const webpush = (await import("web-push")).default;
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT ?? "mailto:redaksjon@tulltall.no",
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
    process.env.VAPID_PRIVATE_KEY!,
  );
  const subs = await db.query<{ endpoint: string; keys: { p256dh: string; auth: string } }>(
    `SELECT endpoint, keys FROM push_subscriptions
     WHERE topics ? 'daily' AND (last_sent_at IS NULL OR last_sent_at < now() - interval '20 hours')
     ORDER BY created_at LIMIT $1`,
    [limit],
  );
  let sent = 0;
  let removed = 0;
  let failed = 0;
  for (const s of subs) {
    try {
      await webpush.sendNotification({ endpoint: s.endpoint, keys: s.keys }, JSON.stringify(payload), { TTL: 6 * 3600, urgency: "low" });
      await db.query(`UPDATE push_subscriptions SET last_sent_at = now(), failures = 0 WHERE endpoint = $1`, [s.endpoint]);
      sent++;
    } catch (err) {
      const status = (err as { statusCode?: number }).statusCode;
      if (status === 404 || status === 410) {
        await db.query(`DELETE FROM push_subscriptions WHERE endpoint = $1`, [s.endpoint]);
        removed++;
      } else {
        await db.query(`UPDATE push_subscriptions SET failures = failures + 1 WHERE endpoint = $1`, [s.endpoint]);
        failed++;
      }
    }
  }
  await db.query(`DELETE FROM push_subscriptions WHERE failures >= 5`);
  return { sent, removed, failed };
}
