"use client";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { t, formatNumber } from "@/lib/i18n";
import { api } from "@/lib/client/api";
import { store } from "@/lib/client/storage";
import type { Profile } from "@/lib/profile/service";
import type { TopRow } from "@/lib/toplist/queries";

/** Topp 10: i dag og denne uken. Bare spillere som selv har sagt ja vises. */
export function TopList() {
  const [period, setPeriod] = useState<"day" | "week">("day");
  const [rows, setRows] = useState<TopRow[] | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [hasPlayer, setHasPlayer] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(
    (fresh = false) => {
      api.toplist(period, fresh).then(setRows).catch(() => setRows([]));
    },
    [period],
  );
  useEffect(() => load(), [load]);

  useEffect(() => {
    const id = store.getPlayerId();
    setHasPlayer(Boolean(id));
    if (id) api.profile({ playerId: id, action: "get" }).then((r) => setProfile(r.profile)).catch(() => undefined);
  }, []);

  const join = async () => {
    const id = store.getPlayerId();
    if (!id) return;
    setBusy(true);
    try {
      const r = await api.profile({ playerId: id, action: "update", showOnLists: true });
      setProfile(r.profile);
      load(true);
    } finally {
      setBusy(false);
    }
  };

  const label = period === "day" ? t("top.listLabelToday") : t("top.listLabelWeek");
  return (
    <section className="border-b-[2.5px] border-blekk bg-papir-2">
      <div className="mx-auto max-w-5xl px-4 py-12">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h2 className="font-black font-wide uppercase text-[clamp(2.2rem,9vw,3.4rem)] leading-[0.9]">{t("top.title")}</h2>
          <div className="flex gap-2" role="group" aria-label={t("top.title")}>
            {(["day", "week"] as const).map((p) => (
              <button
                key={p}
                type="button"
                aria-pressed={period === p}
                onClick={() => setPeriod(p)}
                className={`rounded-full border-[2.5px] border-blekk px-4 py-2 font-black ${period === p ? "bg-blekk text-papir" : "bg-papir"}`}
              >
                {p === "day" ? t("top.today") : t("top.week")}
              </button>
            ))}
          </div>
        </div>

        {rows === null ? (
          <p className="mt-6 text-lg" aria-busy="true">&nbsp;</p>
        ) : rows.length === 0 ? (
          <p className="mt-6 text-xl font-bold">{t("top.empty")}</p>
        ) : (
          <ol aria-label={label} className="mt-6 grid gap-2.5 max-w-xl">
            {rows.map((r) => {
              const me = profile?.showOnLists && r.handle === profile.handle;
              return (
                <li
                  key={`${r.rank}-${r.handle}`}
                  className={`flex items-center gap-3 rounded-xl border-[2.5px] border-blekk px-4 py-3 shadow-[3px_3px_0_var(--color-blekk)] ${me ? "bg-syre" : "bg-papir"}`}
                >
                  <span className="font-black font-condensed text-3xl w-9 tabular text-kobolt">{r.rank}</span>
                  <span className="flex-1 min-w-0">
                    <span className="block font-black text-lg leading-tight truncate">
                      {r.handle}
                      {me ? ` (${t("top.you")})` : ""}
                    </span>
                    <span className="block text-sm text-blekk-2">{t("top.row", { hits: r.hits, total: r.total })}</span>
                  </span>
                  <span className="font-black text-xl tabular">{formatNumber(r.score)}</span>
                </li>
              );
            })}
          </ol>
        )}
        {period === "week" ? <p className="mt-3 text-sm text-blekk-2">{t("top.weekNote")}</p> : null}

        <div className="mt-6">
          {profile?.today ? <p className="font-bold text-lg mb-3">{t("top.yourRank", { rank: profile.today.rank, total: profile.today.total })}</p> : null}
          {profile?.showOnLists ? (
            <p className="font-bold">
              ✓ {t("top.joined")} · <Link href="/profil" className="underline underline-offset-4">{t("nav.profile")}</Link>
            </p>
          ) : hasPlayer && profile?.runs ? (
            <button type="button" className="btn btn-primary text-lg" disabled={busy} onClick={() => void join()}>
              {t("top.join")}
            </button>
          ) : (
            <Link href="/spill" className="btn btn-acid">
              {t("top.play")} →
            </Link>
          )}
        </div>
      </div>
    </section>
  );
}
