import type { Metadata } from "next";
import Link from "next/link";
import { getDb } from "@/lib/db/client";
import { weeklyStandings, RIVALRIES, kommuneByNr } from "@/lib/nabokrig/queries";
import { getSettings } from "@/lib/db/settings";
import { isoWeek, localDate } from "@/lib/game/dates";
import { t } from "@/lib/i18n";
import { Standings } from "@/components/nabokrig/Standings";
import { KommunePicker } from "@/components/nabokrig/KommunePicker";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Nabokrigen", description: "Kommunene konkurrerer i kunnskap. Spill for din kommune." };

export default async function Nabokrigen() {
  const db = await getDb();
  const today = localDate();
  const [rows, settings] = await Promise.all([weeklyStandings(db, today), getSettings(db)]);
  const rivals = await Promise.all(
    RIVALRIES.slice(0, 8).map(async ([a, b]) => {
      const [ka, kb] = await Promise.all([kommuneByNr(db, a), kommuneByNr(db, b)]);
      return ka && kb ? { a: ka, b: kb } : null;
    }),
  );
  return (
    <div>
      <section className="border-b-[2.5px] border-blekk bg-korall">
        <div className="mx-auto max-w-5xl px-4 py-12">
          <p className="kicker">{t("nabokrig.week", { week: isoWeek(today).split("-W")[1] })}</p>
          <h1 className="font-black font-wide uppercase text-[clamp(3rem,13vw,6rem)] leading-[0.82] mt-2">{t("nabokrig.title")}</h1>
          <p className="serif-soft text-xl mt-5 max-w-2xl">{t("nabokrig.lead")}</p>
        </div>
      </section>
      <div className="mx-auto max-w-5xl px-4 py-12 grid gap-12 lg:grid-cols-[1.4fr_1fr]">
        <section>
          <h2 className="font-black font-wide uppercase text-2xl mb-5">{t("nabokrig.leaderboard")}</h2>
          <Standings rows={rows} minPlayers={settings.nabokrigMinPlayers} />
          <details className="mt-8 rounded-xl border-2 border-dashed border-blekk p-4">
            <summary className="cursor-pointer font-black font-wide uppercase text-sm">{t("nabokrig.model")}</summary>
            <p className="serif-soft mt-3">{t("nabokrig.modelText")}</p>
            <Link href="/om#nabokrigen" className="kicker underline underline-offset-4 mt-3 inline-block">
              Les hele modellen →
            </Link>
          </details>
        </section>
        <aside className="grid gap-8 content-start">
          <KommunePicker />
          <section>
            <h2 className="kicker mb-3">{t("nabokrig.rivals")}</h2>
            <ul className="grid gap-2">
              {rivals.filter(Boolean).map((r) => (
                <li key={`${r!.a.nr}-${r!.b.nr}`}>
                  <Link
                    href={`/nabokrigen/${r!.a.slug}-mot-${r!.b.slug}`}
                    className="flex items-center justify-between rounded-xl border-2 border-blekk bg-papir px-4 py-2.5 font-black uppercase hover:bg-syre"
                  >
                    <span>{r!.a.name}</span>
                    <span className="kicker text-korall-dyp">{t("challenge.versus")}</span>
                    <span>{r!.b.name}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        </aside>
      </div>
    </div>
  );
}
