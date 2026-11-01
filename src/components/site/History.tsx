"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { t, formatNumber } from "@/lib/i18n";
import { computeStreak, store, type HistoryEntry } from "@/lib/client/storage";
import { api } from "@/lib/client/api";
import { PunchHoles } from "@/components/ui/Ticket";
import { localDate } from "@/lib/game/dates";

export function History() {
  const [items, setItems] = useState<HistoryEntry[] | null>(null);
  const [cleared, setCleared] = useState(false);
  useEffect(() => setItems(store.getHistory()), []);
  if (items === null) return null;
  const daily = items.filter((i) => i.kind === "daily");
  const best = daily.length ? Math.max(...daily.map((d) => d.score)) : null;
  const avg = daily.length ? Math.round(daily.reduce((s, d) => s + d.score, 0) / daily.length) : null;
  return (
    <div className="mx-auto max-w-2xl px-4 py-12">
      <h1 className="font-black font-wide uppercase text-4xl">{t("history.title")}</h1>
      <p className="text-blekk-2 mt-2">{t("history.note")}</p>
      {items.length === 0 ? (
        <p className="mt-8 font-bold">{cleared ? t("history.cleared") : t("history.empty")}</p>
      ) : (
        <>
          <dl className="mt-8 grid grid-cols-3 gap-3">
            {[
              [t("history.played"), formatNumber(daily.length)],
              [t("history.best"), best !== null ? formatNumber(best) : "–"],
              [t("history.avg"), avg !== null ? formatNumber(avg) : "–"],
            ].map(([k, v]) => (
              <div key={k} className="rounded-xl border-2 border-blekk bg-papir p-3">
                <dt className="kicker">{k}</dt>
                <dd className="font-black text-3xl tabular">{v}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-4 kicker">🔥 {t.plural("home.streak", computeStreak(items, localDate()))}</p>
          <ol className="mt-8 grid gap-3">
            {items.map((h) => (
              <li key={h.gameId} className="rounded-xl border-2 border-blekk bg-papir p-4 flex flex-wrap items-center gap-3 justify-between">
                <div>
                  <p className="kicker">{h.date ?? h.gameId}</p>
                  <p className="font-black uppercase">{t(`result.titles.${h.titleKey}` as "result.titles.5")}</p>
                </div>
                <PunchHoles pattern={h.pattern} size={12} />
                <span className="font-black tabular">{formatNumber(h.score)}</span>
              </li>
            ))}
          </ol>
          <button
            type="button"
            className="btn btn-ghost mt-8"
            onClick={async () => {
              const pid = store.getPlayerId();
              if (pid) await api.deletePlayer(pid).catch(() => undefined);
              store.clearHistory();
              store.setKommune(null);
              setItems([]);
              setCleared(true);
            }}
          >
            {t("history.clear")}
          </button>
        </>
      )}
      <details className="mt-10 text-sm">
        <summary className="cursor-pointer kicker">Din anonyme spiller-ID</summary>
        <p className="mt-2 font-mono break-all">{store.getPlayerId() ?? "–"}</p>
        <p className="text-blekk-2 mt-1">Oppgi denne hvis du ber oss om innsyn eller sletting.</p>
      </details>
      <p className="mt-8">
        <Link href="/spill" className="btn btn-primary">
          {t("nav.today")} →
        </Link>
      </p>
    </div>
  );
}
