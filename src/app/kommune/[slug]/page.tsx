import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getDb } from "@/lib/db/client";
import { kommuneBySlug, weeklyStandings, RIVALRIES, kommuneByNr } from "@/lib/nabokrig/queries";
import { addDays, isoWeek, localDate } from "@/lib/game/dates";
import { t, formatNumber } from "@/lib/i18n";
import { PlayForButton } from "@/components/nabokrig/PlayForButton";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const k = await kommuneBySlug(await getDb(), (await params).slug);
  return k ? { title: t("nabokrig.kommunePage", { kommune: k.name }) } : {};
}

export default async function KommunePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const db = await getDb();
  const k = await kommuneBySlug(db, slug);
  if (!k) notFound();
  const today = localDate();
  const weeks = await Promise.all(
    [0, 1, 2, 3].map(async (w) => {
      const date = addDays(today, -7 * w);
      const row = (await weeklyStandings(db, date)).find((r) => r.nr === k.nr);
      return { week: isoWeek(date), row };
    }),
  );
  const rivalNrs = RIVALRIES.filter(([a, b]) => a === k.nr || b === k.nr).map(([a, b]) => (a === k.nr ? b : a));
  const neighbours = rivalNrs.length
    ? (await Promise.all(rivalNrs.map((nr) => kommuneByNr(db, nr)))).filter(Boolean)
    : await db.query<{ nr: string; name: string; slug: string }>(
        `SELECT nr, name, slug FROM kommuner WHERE fylke_nr = $1 AND nr <> $2 ORDER BY population DESC NULLS LAST LIMIT 4`,
        [k.fylke_nr, k.nr],
      );
  const current = weeks[0].row;

  return (
    <div className="mx-auto max-w-4xl px-4 py-12">
      <p className="kicker">
        {t("nabokrig.fylke")}: {k.fylke_name} · Kommunenr. {k.nr}
      </p>
      <h1 className="font-black font-wide uppercase text-[clamp(2.6rem,12vw,5.5rem)] leading-[0.85] mt-2 break-words">{k.name}</h1>
      {k.alt_names.length ? <p className="serif-soft italic text-xl mt-2">{k.alt_names.join(" / ")}</p> : null}
      {k.population ? (
        <p className="mt-4 text-blekk-2">
          {t("nabokrig.population")}: <strong className="tabular">{formatNumber(k.population)}</strong>{" "}
          <span className="text-sm">({t("nabokrig.populationSource", { date: k.population_date ?? "" })})</span>
        </p>
      ) : null}

      <div className="mt-8 grid gap-6 md:grid-cols-[1.2fr_1fr]">
        <section className="rounded-2xl border-[2.5px] border-blekk bg-syre p-5 shadow-[5px_5px_0_var(--color-blekk)]">
          <h2 className="kicker">{t("nabokrig.thisWeek")}</h2>
          {current ? (
            <dl className="mt-3 grid grid-cols-3 gap-3">
              <div>
                <dt className="kicker">{t("nabokrig.rank")}</dt>
                <dd className="font-black text-4xl tabular">{current.rank ?? "–"}</dd>
              </div>
              <div>
                <dt className="kicker">{t("nabokrig.score")}</dt>
                <dd className="font-black text-4xl tabular">{current.points.toFixed(1)}</dd>
              </div>
              <div>
                <dt className="kicker">{t("nabokrig.players")}</dt>
                <dd className="font-black text-4xl tabular">{current.players}</dd>
              </div>
            </dl>
          ) : (
            <p className="mt-3 font-bold">{t("nabokrig.empty")}</p>
          )}
          <div className="mt-5">
            <PlayForButton kommune={{ nr: k.nr, name: k.name, slug: k.slug }} />
          </div>
        </section>
        <section>
          <h2 className="kicker mb-3">{t("nabokrig.lastWeeks")}</h2>
          <ol className="grid gap-2">
            {weeks.map((w) => (
              <li key={w.week} className="flex justify-between rounded-xl border-2 border-blekk bg-papir px-4 py-2 font-bold">
                <span>{t("nabokrig.week", { week: w.week.split("-W")[1] })}</span>
                <span className="tabular">{w.row ? `${w.row.points.toFixed(1)} · ${w.row.players} sp.` : "–"}</span>
              </li>
            ))}
          </ol>
        </section>
      </div>

      {neighbours.length ? (
        <section className="mt-10">
          <h2 className="kicker mb-3">{t("nabokrig.duelCta")}</h2>
          <ul className="flex flex-wrap gap-2">
            {neighbours.map((n) => (
              <li key={n!.nr}>
                <Link href={`/nabokrigen/${k.slug}-mot-${n!.slug}`} className="inline-block rounded-full border-2 border-blekk px-4 py-2 font-black uppercase hover:bg-korall">
                  {k.name} {t("challenge.versus")} {n!.name}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
