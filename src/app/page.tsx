import Link from "next/link";
import { getDb } from "@/lib/db/client";
import { publishDailyGame } from "@/lib/db/games";
import { getQuestionRows } from "@/lib/db/questions";
import { localDate, roundNumber } from "@/lib/game/dates";
import { brand } from "@/lib/config/brand";
import { t } from "@/lib/i18n";
import { Logo } from "@/components/ui/Logo";
import { HomeTicket } from "@/components/home/HomeTicket";
import { KommuneBadge } from "@/components/home/KommuneBadge";
import { weeklyStandings } from "@/lib/nabokrig/queries";
import { FormatGlyph } from "@/components/home/FormatGlyph";

export const dynamic = "force-dynamic";

const FORMATS = ["truefalse", "estimate", "compare", "rank", "trend", "map"] as const;

export default async function Home() {
  const db = await getDb();
  const today = localDate();
  const game = await publishDailyGame(db, today);
  const rows = game ? await getQuestionRows(db, game.question_ids) : [];
  const topics = [...new Set(rows.map((r) => r.content.kicker ?? r.topic))].slice(0, 8);
  const standings = (await weeklyStandings(db, today)).filter((s) => s.ranked).slice(0, 3);

  return (
    <div>
      {/* Topper: logo + billett. Ingen tom hero – spillet starter her. */}
      <section className="relative overflow-hidden border-b-[2.5px] border-blekk">
        <div className="absolute -left-16 top-24 w-72 h-72 rounded-full halftone text-korall/50 overprint" aria-hidden />
        <div className="absolute right-[-6rem] top-[-4rem] w-96 h-96 rounded-full bg-syre overprint opacity-80" aria-hidden />
        <div className="relative mx-auto max-w-5xl px-4 pt-8 pb-14 grid gap-10 md:grid-cols-[1.1fr_1fr] md:items-center">
          <div>
            <h1 className="sr-only">{brand.name}</h1>
            <Logo size="xl" />
            <p className="mt-5 serif-soft italic text-[1.45rem] leading-snug max-w-sm">{t("home.tagline")}</p>
            <p className="mt-3 max-w-md text-blekk-2">{t("home.rulesLong")}</p>
            <p className="mt-4 kicker">{t("home.rules")}</p>
          </div>
          {game ? (
            <HomeTicket gameId={game.id} date={today} roundNumber={roundNumber(today, brand.launchDate)} count={game.question_ids.length} />
          ) : (
            <p className="font-bold">{t("home.noGame")}</p>
          )}
        </div>
        {topics.length ? (
          <div className="relative border-t-[2.5px] border-blekk bg-blekk text-papir overflow-hidden py-2.5" aria-label={t("home.teaser")}>
            <div className="flex w-max animate-marquee whitespace-nowrap">
              {[0, 1].map((k) => (
                <span key={k} className="flex gap-8 pr-8 kicker" aria-hidden={k === 1}>
                  <span className="text-syre">{t("home.teaser")}</span>
                  {topics.map((tp) => (
                    <span key={tp}>✦ {tp}</span>
                  ))}
                </span>
              ))}
            </div>
          </div>
        ) : null}
      </section>

      {/* Seks formater */}
      <section className="mx-auto max-w-5xl px-4 py-16">
        <h2 className="font-black font-wide uppercase text-3xl sm:text-4xl leading-none">{t("home.formatsTitle")}</h2>
        <ul className="mt-8 grid gap-4 grid-cols-2 lg:grid-cols-3">
          {FORMATS.map((f, i) => (
            <li
              key={f}
              className="relative rounded-2xl border-[2.5px] border-blekk bg-papir p-4 shadow-[4px_4px_0_var(--color-blekk)]"
              style={{ transform: `rotate(${[-1.5, 1, -0.6, 1.4, -1, 0.7][i]}deg)` }}
            >
              <FormatGlyph format={f} />
              <p className="mt-3 kicker text-kobolt">{t(`game.formats.${f}`)}</p>
              <p className="font-bold leading-snug mt-1">{t(`home.formats.${f}`)}</p>
            </li>
          ))}
        </ul>
      </section>

      {/* Nabokrigen */}
      <section className="border-y-[2.5px] border-blekk bg-korall">
        <div className="mx-auto max-w-5xl px-4 py-14 grid gap-8 md:grid-cols-2 md:items-center">
          <div>
            <h2 className="font-black font-wide uppercase text-[clamp(2.4rem,9vw,4rem)] leading-[0.85]">{t("home.nabokrigTitle")}</h2>
            <p className="serif-soft text-lg mt-4 max-w-md">{t("home.nabokrigText")}</p>
            <div className="mt-6 flex flex-wrap gap-3">
              <KommuneBadge />
              <Link href="/nabokrigen" className="btn btn-ghost">
                {t("nabokrig.leaderboard")}
              </Link>
            </div>
          </div>
          <ol className="grid gap-3">
            {standings.length ? (
              standings.map((s) => (
                <li key={s.nr} className="flex items-center gap-4 rounded-xl border-[2.5px] border-blekk bg-papir px-4 py-3 shadow-[3px_3px_0_var(--color-blekk)]">
                  <span className="font-black font-condensed text-4xl w-8">{s.rank}</span>
                  <Link href={`/kommune/${s.slug}`} className="font-black uppercase text-xl flex-1 hover:underline">
                    {s.name}
                  </Link>
                  <span className="font-mono tabular">{s.points.toFixed(1)}</span>
                </li>
              ))
            ) : (
              <li className="rounded-xl border-[2.5px] border-dashed border-blekk bg-papir/70 px-4 py-6 font-bold">{t("nabokrig.empty")}</li>
            )}
          </ol>
        </div>
      </section>

      {/* Manifest */}
      <section className="mx-auto max-w-3xl px-4 py-16">
        <p className="serif-soft text-[clamp(1.4rem,4.5vw,2rem)] leading-[1.25]">
          Hver dag: ti påstander og tall om Norge. Noen er morsomme, noen er overraskende, og noen utfordrer det mange tar for gitt.
          <span className="bg-syre px-1"> Alle har kilder.</span> Ingen av dem forteller deg hva du skal mene.
        </p>
        <p className="mt-6">
          <Link href="/om" className="kicker underline underline-offset-4">
            {t("nav.about")} →
          </Link>
        </p>
      </section>
    </div>
  );
}
