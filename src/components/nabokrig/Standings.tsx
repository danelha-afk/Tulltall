import Link from "next/link";
import { t, formatNumber } from "@/lib/i18n";
import type { StandingRow } from "@/lib/nabokrig/queries";

export function Standings({ rows, minPlayers }: { rows: StandingRow[]; minPlayers: number }) {
  const ranked = rows.filter((r) => r.ranked);
  const unranked = rows.filter((r) => !r.ranked).slice(0, 12);
  if (!rows.length) return <p className="font-bold rounded-xl border-2 border-dashed border-blekk p-6">{t("nabokrig.empty")}</p>;
  return (
    <div>
      {ranked.length ? (
        <div className="overflow-x-auto rounded-2xl border-[2.5px] border-blekk bg-papir shadow-[5px_5px_0_var(--color-blekk)]">
          <table className="w-full text-left">
            <caption className="sr-only">{t("nabokrig.leaderboard")}</caption>
            <thead className="bg-blekk text-papir">
              <tr className="kicker">
                <th scope="col" className="px-3 py-2">{t("nabokrig.rank")}</th>
                <th scope="col" className="px-3 py-2">{t("nabokrig.kommune")}</th>
                <th scope="col" className="px-3 py-2 text-right">{t("nabokrig.score")}</th>
                <th scope="col" className="px-3 py-2 text-right hidden sm:table-cell">{t("nabokrig.players")}</th>
                <th scope="col" className="px-3 py-2 text-right hidden sm:table-cell">{t("nabokrig.perThousand")}</th>
              </tr>
            </thead>
            <tbody>
              {ranked.map((r) => (
                <tr key={r.nr} className="border-t-2 border-blekk/15 even:bg-papir-2/50">
                  <td className="px-3 py-2.5 font-black font-condensed text-2xl tabular">{r.rank}</td>
                  <td className="px-3 py-2.5">
                    <Link href={`/kommune/${r.slug}`} className="font-black uppercase hover:underline">
                      {r.name}
                    </Link>
                    <span className="block kicker text-blekk-3">{r.fylke}</span>
                  </td>
                  <td className="px-3 py-2.5 text-right font-black tabular text-lg">{r.points.toFixed(1)}</td>
                  <td className="px-3 py-2.5 text-right tabular hidden sm:table-cell">{formatNumber(r.players)}</td>
                  <td className="px-3 py-2.5 text-right tabular hidden sm:table-cell">{r.playersPerThousand.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
      {unranked.length ? (
        <div className="mt-6">
          <h3 className="kicker mb-2">{t("nabokrig.unranked")}</h3>
          <p className="text-sm text-blekk-2 mb-3">{t("nabokrig.needMore", { n: minPlayers })}</p>
          <ul className="flex flex-wrap gap-2">
            {unranked.map((r) => (
              <li key={r.nr}>
                <Link href={`/kommune/${r.slug}`} className="inline-block rounded-full border-2 border-blekk px-3 py-1 font-bold text-sm hover:bg-syre">
                  {r.name} · {r.players}/{minPlayers}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
