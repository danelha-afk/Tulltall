"use client";
import Link from "next/link";
import { motion, useReducedMotion } from "motion/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { t } from "@/lib/i18n";
import { computeStreak, store, type HistoryEntry } from "@/lib/client/storage";
import { PunchHoles } from "@/components/ui/Ticket";

/**
 * Startbilletten: Trykk (eller dra) for å rive av billetten – og runden starter.
 * Viser «fortsett» eller resultatet hvis dagens runde allerede er påbegynt/spilt.
 */
export function HomeTicket({ gameId, date, roundNumber, count }: { gameId: string; date: string; roundNumber: number; count: number }) {
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
    setTimeout(() => router.push("/spill"), reduced ? 0 : 520);
  };

  const label = played ? t("home.playedCta") : inProgress ? t("home.continueCta") : t("home.tearCta");

  return (
    <div className="relative">
      <div className="relative mx-auto max-w-md">
        {/* Stammen som blir igjen */}
        <div className="relative z-0 rounded-t-[18px] border-[2.5px] border-b-0 border-blekk bg-papir-2 px-6 pt-4 pb-3 flex items-center justify-between">
          <span className="kicker">Nr. {String(roundNumber).padStart(4, "0")}</span>
          <span className="kicker">{new Date(`${date}T12:00:00Z`).toLocaleDateString("nb-NO", { weekday: "long", day: "numeric", month: "long" })}</span>
        </div>
        <div className="perforation relative z-10 -my-[2px]" aria-hidden />
        <motion.button
          type="button"
          onClick={go}
          aria-label={label}
          animate={torn && !reduced ? { y: 40, rotate: 9, opacity: 0 } : { y: 0, rotate: 0, opacity: 1 }}
          transition={{ duration: 0.5, ease: [0.5, 0, 0.75, 0] }}
          whileHover={reduced ? {} : { rotate: -1.2, y: -2 }}
          whileTap={reduced ? {} : { rotate: 3, y: 6 }}
          className="relative z-0 block w-full text-left rounded-b-[18px] border-[2.5px] border-t-0 border-blekk bg-kobolt text-papir px-6 pt-6 pb-7 shadow-[6px_7px_0_var(--color-blekk)] overflow-hidden"
        >
          <div className="absolute -right-10 -top-10 w-44 h-44 rounded-full halftone text-syre/60" aria-hidden />
          <p className="kicker text-syre">{t("home.roundLabel", { n: roundNumber })}</p>
          <p className="mt-3 font-black font-semi-condensed uppercase text-[clamp(2.3rem,11vw,3.6rem)] leading-[0.88]">
            {count} spørsmål.
            <br />
            <span className="text-syre misprint">Null klokke.</span>
          </p>
          {played ? (
            <div className="mt-5 bg-papir text-blekk rounded-xl p-3 border-2 border-blekk">
              <PunchHoles pattern={played.pattern} size={16} />
              <p className="kicker mt-2">{t("result.hitsOf", { hits: played.hits, total: played.total })}</p>
            </div>
          ) : null}
          <span className="mt-6 inline-flex items-center gap-3 rounded-full bg-syre text-blekk border-[2.5px] border-blekk px-5 py-3 font-black font-wide uppercase text-lg shadow-[3px_3px_0_var(--color-blekk)]">
            {label} <span aria-hidden>→</span>
          </span>
          {!played ? <p className="kicker mt-3 text-papir">{t("home.tearHint")}</p> : null}
        </motion.button>
      </div>
      {streak > 0 ? <p className="text-center kicker mt-5">🔥 {t.plural("home.streak", streak)}</p> : null}
      <p className="text-center mt-3">
        <Link href="/historikk" className="kicker underline underline-offset-4">
          {t("nav.history")}
        </Link>
      </p>
    </div>
  );
}
