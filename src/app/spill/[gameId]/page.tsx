import { notFound } from "next/navigation";
import { GamePlayer } from "@/components/game/GamePlayer";

export default async function PlayGame({ params }: { params: Promise<{ gameId: string }> }) {
  const { gameId } = await params;
  if (!/^(d-\d{4}-\d{2}-\d{2}|q-[a-z0-9-]{3,81})$/.test(gameId)) notFound();
  return <GamePlayer gameId={gameId} single={gameId.startsWith("q-")} />;
}
