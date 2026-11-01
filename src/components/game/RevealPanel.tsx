"use client";
import { motion, useReducedMotion } from "motion/react";
import { t } from "@/lib/i18n";
import { track } from "@/lib/client/track";
import { Stamp } from "@/components/ui/Stamp";
import { ShareButton } from "./ShareButton";
import type { RevealState } from "./types";

/**
 * Avsløringens tekstdel: punchline, kort forklaring, og to valgfrie dører for de nysgjerrige –
 * «Hvor kommer tallet fra?» og «Hva sier tallene egentlig?».
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

  return (
    <motion.section
      aria-live="polite"
      initial={{ opacity: 0, y: reduced ? 0 : 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
      className="mt-8 relative bg-papir border-[2.5px] border-blekk rounded-2xl shadow-[5px_5px_0_var(--color-blekk)] overflow-hidden"
    >
      <div className={`px-5 pt-5 pb-4 ${serious ? "bg-papir-2" : reveal.hit ? "bg-syre" : "bg-rosa"} border-b-[2.5px] border-blekk`}>
        <div className="flex items-start justify-between gap-3">
          {reveal.retracted ? (
            <p className="font-bold">{t("game.retracted")}</p>
          ) : (
            <>
              <span className="kicker">
                {reveal.hit ? t("game.correct") : t("game.wrong")} · {t("game.pointsOne", { points: reveal.points })}
              </span>
              {!serious && reveal.hit ? (
                <span className="text-base -mt-1">
                  <Stamp color="kobolt" rotate={-6}>Treff</Stamp>
                </span>
              ) : null}
            </>
          )}
        </div>
        <h3 className="mt-2 font-black font-semi-condensed uppercase text-[1.6rem] sm:text-[1.9rem] leading-[0.98]">{d.reveal.headline}</h3>
      </div>
      <div className="px-5 py-5">
        <p className="serif-soft text-[1.12rem] leading-[1.5]">{d.reveal.explanation}</p>

        {d.reveal.deepDive ? (
          <details className="group mt-5 rounded-xl border-2 border-blekk bg-papir-2/60" onToggle={(e) => (e.currentTarget as HTMLDetailsElement).open && track("reveal_deepdive_open", { q: questionId })}>
            <summary className="cursor-pointer list-none px-4 py-3 font-black font-wide uppercase text-sm flex items-center justify-between">
              {t("game.deepDive")}
              <span className="transition-transform group-open:rotate-45 text-xl leading-none" aria-hidden>
                +
              </span>
            </summary>
            <div className="px-4 pb-4 serif-soft text-[1rem] leading-relaxed">{d.reveal.deepDive}</div>
          </details>
        ) : null}

        <details className="group mt-3 rounded-xl border-2 border-dashed border-blekk/60" onToggle={(e) => (e.currentTarget as HTMLDetailsElement).open && track("reveal_source_open", { q: questionId })}>
          <summary className="cursor-pointer list-none px-4 py-3 kicker flex items-center justify-between">
            {t("game.whereFrom")}
            <span className="transition-transform group-open:rotate-45 text-lg leading-none" aria-hidden>
              +
            </span>
          </summary>
          <dl className="px-4 pb-4 text-sm grid gap-2">
            <div>
              <dt className="kicker text-blekk-3">{t("game.source")}</dt>
              <dd>
                <ul className="grid gap-1">
                  {d.sources.map((s) => (
                    <li key={s.url}>
                      <a href={s.url} target="_blank" rel="noopener noreferrer" className="underline decoration-2 underline-offset-2 text-kobolt font-semibold break-words">
                        {s.publisher}: {s.title}
                      </a>
                      {s.tableId ? <span className="font-mono text-xs ml-1">(tabell {s.tableId})</span> : null}
                    </li>
                  ))}
                </ul>
              </dd>
            </div>
            <div>
              <dt className="kicker text-blekk-3">{t("game.referencePeriod")}</dt>
              <dd>{d.referencePeriod}</dd>
            </div>
            {d.calculation ? (
              <div>
                <dt className="kicker text-blekk-3">{t("game.calculation")}</dt>
                <dd className="font-mono text-xs">{d.calculation}</dd>
              </div>
            ) : null}
            {d.reveal.caveats.length ? (
              <div>
                <dt className="kicker text-blekk-3">{t("game.caveats")}</dt>
                <dd>
                  <ul className="list-[square] pl-4">
                    {d.reveal.caveats.map((c) => (
                      <li key={c}>{c}</li>
                    ))}
                  </ul>
                </dd>
              </div>
            ) : null}
            <div>
              <dt className="kicker text-blekk-3">{t("game.lastVerified")}</dt>
              <dd>
                {new Date(`${d.lastVerified}T12:00:00Z`).toLocaleDateString("nb-NO", { day: "numeric", month: "long", year: "numeric" })} –{" "}
                {t(`game.verification.${d.verification.method}` as "game.verification.derived")}
              </dd>
            </div>
          </dl>
        </details>

        <div className="mt-6 flex flex-wrap items-center gap-3 justify-between">
          <ShareButton
            kind="question"
            url={`/s/${questionId}?ref=q:${questionId}`}
            text={t("game.shareQuestionText", { text: shareText ?? "" })}
            label={t("game.shareQuestion")}
            sessionId={sessionId}
            small
          />
          <button type="button" className="btn btn-primary text-lg min-w-48" onClick={onNext} autoFocus>
            {isLast ? t("game.finish") : t("game.next")} →
          </button>
        </div>
      </div>
    </motion.section>
  );
}
