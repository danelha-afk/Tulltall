import type { Metadata } from "next";
import { GamePlayer } from "@/components/game/GamePlayer";
import { t } from "@/lib/i18n";

export const metadata: Metadata = { title: t("nav.today") };

export default async function PlayToday({ searchParams }: { searchParams: Promise<{ u?: string }> }) {
  const { u } = await searchParams;
  const code = u && /^[a-z0-9]{6,12}$/.test(u) ? u : undefined;
  return <GamePlayer challengeCode={code} />;
}
