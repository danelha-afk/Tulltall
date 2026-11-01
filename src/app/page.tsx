import Link from "next/link";
import { getDb } from "@/lib/db/client";
import { publishDailyGame } from "@/lib/db/games";
import { localDate } from "@/lib/game/dates";
import { brand } from "@/lib/config/brand";
import { t } from "@/lib/i18n";
import { Logo } from "@/components/ui/Logo";
import { HomeTicket } from "@/components/home/HomeTicket";
import { KommuneBadge } from "@/components/home/KommuneBadge";

export const dynamic = "force-dynamic";

export default async function Home() {
  const db = await getDb();
  const today = localDate();
  const game = await publishDailyGame(db, today);

  return (
    <div>
      <section className="relative overflow-hidden border-b-[2.5px] border-blekk">
        <div className="absolute right-[-7rem] top-[-5rem] w-80 h-80 rounded-full bg-syre overprint opacity-80" aria-hidden />
        <div className="relative mx-auto max-w-5xl px-4 pt-6 pb-12 grid gap-7 md:grid-cols-2 md:items-center">
          <div>
            <h1 className="sr-only">{brand.name}</h1>
            <Logo size="xl" />
            <p className="mt-3 serif-soft italic text-[1.35rem] leading-snug">{t("home.tagline")}</p>
          </div>
          {game ? <HomeTicket gameId={game.id} date={today} count={game.question_ids.length} /> : <p className="font-bold text-lg">{t("home.noGame")}</p>}
        </div>
      </section>

      <section className="bg-korall border-b-[2.5px] border-blekk">
        <div className="mx-auto max-w-5xl px-4 py-12">
          <h2 className="font-black font-wide uppercase text-[clamp(2.2rem,9vw,3.6rem)] leading-[0.9]">{t("home.nabokrigTitle")}</h2>
          <p className="text-xl mt-3 max-w-md">{t("home.nabokrigShort")}</p>
          <div className="mt-6 flex flex-wrap gap-3">
            <KommuneBadge />
            <Link href="/nabokrigen" className="btn btn-ghost">
              {t("nabokrig.leaderboard")}
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
