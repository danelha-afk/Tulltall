"use client";
import { motion, useReducedMotion } from "motion/react";
import { t } from "@/lib/i18n";
import { track } from "@/lib/client/track";
import { ShareButton } from "./ShareButton";
import type { RevealState } from "./types";

/**
 * Etter svaret: én stor dom, én kort forklaring og én stor «Neste»-knapp.
 * Kilder og metode ligger bak én lukket dør for dem som vil vite mer.
 */
export function RevealPanel({
  reveal,
  questionId,
  shareText,
  onNext,
  isLast,
  sessionId,
}: {
  reveal: RevealState;
  questionId: string;
  shareText?: string;
  onNext: () => void;
  isLast: boolean;
  sessionId?: string;
}) {
  const reduced = useReducedMotion();
  const d = reveal.data;
  const serious = d.tone === "serious";
  const delay = reduced ? 0 : serious ? 0.3 : 0.9;
  const date = new Date(`${d.lastVerified}T12:00:00Z`).toLocaleDateString("nb-NO", { day: "numeric", month: "long", year: "numeric" });

  return (
    <motion.section
      aria-live="polite"
      initial={{ opacity: 0, y: reduced ? 0 : 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
      className="mt-9 relative bg-papir border-[2.5px] border-blekk rounded-2xl shadow-[5px_5px_0_var(--color-blekk)] overflow-hidden"
    >
      <div className={`px-5 pt-4 pb-4 ${serious ? "bg-papir-2" : reveal.hit ? "bg-syre" : "bg-rosa"} border-b-[2.5px] border-blekk`}>
        {reveal.retracted ? (
          <p className="font-bold">{t("game.retracted")}</p>
        ) : (
          <p className="font-black font-wide uppercase text-2xl leading-none">
            {reveal.hit ? `${t("game.correct")}!` : t("game.wrong")}
          </p>
        )}
        <h3 className="mt-2 font-extrabold text-[1.45rem] leading-[1.15]">{d.reveal.headline}</h3>
      </div>
      <div className="px-5 pt-4 pb-5">
        <p className="serif-soft text-[1.2rem] leading-[1.5]">{d.reveal.explanation}</p>

        <button type="button" className="btn btn-primary w-full mt-6 text-xl !min-h-14" onClick={onNext} autoFocus>
          {isLast ? t("game.finish") : t("game.next")} →
        </button>

        <div className="mt-5 flex flex-wrap items-start justify-between gap-3">
          <details
            className="group flex-1 min-w-[12rem]"
            onToggle={(e) => (e.currentTarget as HTMLDetailsElement).open && track(d.reveal.deepDive ? "reveal_deepdive_open" : "reveal_source_open", { q: questionId })}
          >
            <summary className="cursor-pointer list-none font-semibold underline underline-offset-4 text-blekk-2">
              {d.reveal.deepDive ? t("game.deepDive") : t("game.whereFrom")}
            </summary>
            <div className="mt-3 grid gap-3 text-[0.98rem] leading-relaxed">
              {d.reveal.deepDive ? <p className="serif-soft">{d.reveal.deepDive}</p> : null}
              <p>
                <strong>{t("game.sourceLine")}:</strong>{" "}
                {d.sources.map((s, i) => (
                  <span key={s.url}>
                    {i ? ", " : ""}
                    <a href={s.url} target="_blank" rel="noopener noreferrer" className="underline text-kobolt break-words">
                      {s.publisher}
                    </a>
                  </span>
                ))}
                {" · "}
                <strong>{t("game.period")}:</strong> {d.referencePeriod}
                {" · "}
                <strong>{t("game.checked")}:</strong> {date}
              </p>
              {d.calculation ? <p className="text-sm text-blekk-2">{d.calculation}</p> : null}
              {d.reveal.caveats.length ? (
                <ul className="list-[square] pl-5 text-sm text-blekk-2">
                  {d.reveal.caveats.map((c) => (
                    <li key={c}>{c}</li>
                  ))}
                </ul>
              ) : null}
            </div>
          </details>
          <ShareButton
            kind="question"
            url={`/s/${questionId}`}
            text={t("game.shareQuestionText", { text: shareText ?? "" })}
            label={t("result.share")}
            sessionId={sessionId}
            small
          />
        </div>
      </div>
    </motion.section>
  );
}
