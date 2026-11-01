"use client";
import { motion, useMotionValue, useTransform, useReducedMotion } from "motion/react";
import { useState } from "react";
import { t } from "@/lib/i18n";
import { Stamp } from "@/components/ui/Stamp";
import type { FormatProps } from "./types";

/**
 * «Stempelet»: påstanden står stort på et kort – det er selve spørsmålet. To store knapper under.
 * Kortet kan også dras mot venstre (tull) eller høyre (tall). Fasit stemples på kortet.
 */
export function TrueFalse({ q, onSubmit, busy, reveal }: FormatProps<"truefalse">) {
  const reduced = useReducedMotion();
  const serious = q.tone === "serious";
  const [choice, setChoice] = useState<boolean | null>(null);
  const x = useMotionValue(0);
  const rotate = useTransform(x, [-160, 160], [-8, 8]);

  const answer = reveal && reveal.data.payload.format === "truefalse" ? reveal.data.payload.answer : null;
  const correction = reveal && reveal.data.payload.format === "truefalse" ? reveal.data.payload.correction : undefined;
  const choose = (v: boolean) => {
    if (busy || reveal || choice !== null) return;
    setChoice(v);
    if (typeof navigator !== "undefined" && "vibrate" in navigator && !serious) navigator.vibrate?.(18);
    onSubmit({ format: "truefalse", value: v });
  };
  const stampLabel = (v: boolean) => (serious ? (v ? t("game.tallButton") : t("game.tullButton")) : v ? t("game.tall") : t("game.tull"));

  return (
    <div className="relative">
      <motion.div
        drag={!reveal && choice === null && !reduced ? "x" : false}
        dragSnapToOrigin
        dragElastic={0.6}
        style={{ x, rotate }}
        onDragEnd={(_, info) => {
          if (info.offset.x < -110) choose(false);
          else if (info.offset.x > 110) choose(true);
        }}
        className={`relative mx-auto max-w-md bg-papir border-[2.5px] border-blekk rounded-xl px-6 py-8 shadow-[6px_7px_0_var(--color-blekk)] ${
          !reveal && choice === null && !reduced ? "touch-pan-y" : ""
        }`}
      >
        <h2 className="serif-soft text-[clamp(1.5rem,6.6vw,2rem)] leading-[1.25] font-semibold text-balance">{q.payload.statement}</h2>

        {reveal && answer !== null ? (
          <motion.div
            initial={reduced || serious ? { opacity: 0 } : { scale: 2.4, opacity: 0, rotate: -24 }}
            animate={{ scale: 1, opacity: 1, rotate: answer ? 6 : -8 }}
            transition={serious ? { duration: 0.4 } : { type: "spring", stiffness: 600, damping: 16 }}
            className="pointer-events-none absolute -right-2 -bottom-7 text-[2.3rem]"
          >
            <Stamp color={answer ? "kobolt" : "korall"} rotate={0} style={{ background: "var(--color-papir)" }}>
              {stampLabel(answer)}
            </Stamp>
          </motion.div>
        ) : null}
      </motion.div>

      {reveal && correction ? <p className="mx-auto max-w-md mt-10 serif-soft text-lg border-l-4 border-kobolt pl-4">{correction}</p> : null}

      {!reveal ? (
        <div className="mt-8 grid grid-cols-2 gap-4 max-w-md mx-auto">
          {[false, true].map((v) => (
            <button
              key={String(v)}
              type="button"
              disabled={busy || choice !== null}
              onClick={() => choose(v)}
              className={`flex flex-col items-center justify-center gap-1 min-h-28 rounded-2xl border-[3px] border-blekk shadow-[4px_4px_0_var(--color-blekk)] active:translate-x-1 active:translate-y-1 active:shadow-none transition-transform ${
                v ? "bg-kobolt text-papir" : "bg-korall text-blekk"
              } ${choice === v ? "translate-x-1 translate-y-1 shadow-none ring-4 ring-syre" : ""} ${choice !== null && choice !== v ? "opacity-40" : ""}`}
            >
              <span className="font-black font-wide text-[2rem] leading-none" aria-hidden>
                {v ? "TALL" : "TULL"}
              </span>
              <span className="text-[1.1rem] font-bold">{v ? t("game.tallButton") : t("game.tullButton")}</span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
