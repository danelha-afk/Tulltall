import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { getDb } from "@/lib/db/client";
import { getQuestionRow } from "@/lib/db/questions";
import { recordEvents } from "@/lib/analytics/events";
import { BOT_UA } from "@/lib/http";
import { t } from "@/lib/i18n";
import { GamePlayer } from "@/components/game/GamePlayer";

export const dynamic = "force-dynamic";

async function load(id: string) {
  if (!/^[a-z0-9][a-z0-9-]{2,80}$/.test(id)) return null;
  const row = await getQuestionRow(await getDb(), id);
  if (!row || !["approved", "published"].includes(row.status)) return null;
  return row;
}

export async function generateMetadata({ params }: { params: Promise<{ questionId: string }> }): Promise<Metadata> {
  const { questionId } = await params;
  const row = await load(questionId);
  if (!row) return {};
  const title = row.content.shareText ?? row.content.prompt;
  return { title, description: t("single.title"), openGraph: { title, description: t("meta.description") } };
}

export default async function SingleQuestion({ params }: { params: Promise<{ questionId: string }> }) {
  const { questionId } = await params;
  const row = await load(questionId);
  if (!row) notFound();
  const ua = (await headers()).get("user-agent") ?? "";
  if (!BOT_UA.test(ua)) await recordEvents(await getDb(), [{ name: "single_open", path: `/s/${questionId}`, ref: `q:${questionId}` }], null);
  return (
    <div>
      <div className="mx-auto max-w-2xl px-4 pt-6">
        <p className="kicker inline-block bg-syre border-2 border-blekk rounded-full px-3 py-1">{t("single.title")}</p>
      </div>
      <GamePlayer gameId={`q-${questionId}`} single />
    </div>
  );
}
