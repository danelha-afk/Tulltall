"use client";
import { motion, useReducedMotion } from "motion/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { t } from "@/lib/i18n";
import { computeStreak, store, type HistoryEntry } from "@/lib/client/storage";
import { PunchHoles } from "@/components/ui/Ticket";

/** Én stor billett med én stor knapp. Viser resultatet hvis dagens runde allerede er spilt. */
export function HomeTicket({ gameId, date, count }: { gameId: string; date: string; count: number }) {
  const router = useRouter();
  const reduced = useReducedMotion();
  const [played, setPlayed] = useState<HistoryEntry | null>(null);
  const [inProgress, setInProgress] = useState(false);
  const [streak, setStreak] = useState(0);
  const [torn, setTorn] = useState(false);

  useEffect(() => {
    const h = store.getHistory();
    setPlayed(h.find((x) => x.gameId === gameId) ?? null);
    setInProgress(Boolean(store.getSession(gameId)));
    setStreak(computeStreak(h, date));
  }, [gameId, date]);

  const go = () => {
    if (torn) return;
    setTorn(true);
    if (typeof navigator !== "undefined") navigator.vibrate?.(12);
    setTimeout(() => router.push("/spill"), reduced ? 0 : 420);
  };
  const label = played ? t("home.playedCta") : inProgress ? t("home.continueCta") : t("home.tearCta");
  const day = new Date(`${date}T12:00:00Z`).toLocaleDateString("nb-NO", { weekday: "long", day: "numeric", month: "long" });

  return (
    <motion.div
      animate={torn && !reduced ? { y: 30, rotate: 6, opacity: 0 } : { y: 0, rotate: 0, opacity: 1 }}
      transition={{ duration: 0.42, ease: [0.5, 0, 0.75, 0] }}
      className="mx-auto max-w-md rounded-[18px] border-[3px] border-blekk bg-kobolt text-papir p-6 shadow-[6px_7px_0_var(--color-blekk)] relative overflow-hidden"
    >
      <div className="absolute -right-12 -top-12 w-40 h-40 rounded-full halftone text-syre/50" aria-hidden />
      <p className="relative text-lg font-semibold first-letter:uppercase">{day}</p>
      <p className="relative mt-1 font-black font-wide uppercase text-[2.1rem] leading-none">{t("nav.today")}</p>
      <p className="relative mt-2 text-lg">{t("home.rulesLong").replace("10", String(count))}</p>
      {played ? (
        <div className="relative mt-5 bg-papir text-blekk rounded-xl p-3 border-2 border-blekk">
          <PunchHoles pattern={played.pattern} size={18} />
          <p className="font-bold mt-2 text-lg">{t("result.hitsOf", { hits: played.hits, total: played.total })}</p>
        </div>
      ) : null}
      <button
        type="button"
        onClick={go}
        className="relative mt-6 w-full min-h-16 rounded-full bg-syre text-blekk border-[3px] border-blekk font-black font-wide uppercase text-2xl shadow-[4px_4px_0_var(--color-blekk)] active:translate-x-1 active:translate-y-1 active:shadow-none transition-transform"
      >
        {label} →
      </button>
      {streak > 1 ? <p className="relative text-center font-bold mt-4">🔥 {t.plural("home.streak", streak)}</p> : null}
    </motion.div>
  );
}
