"use client";
import { motion, useMotionValue, useTransform, useReducedMotion } from "motion/react";
import { useState } from "react";
import { t } from "@/lib/i18n";
import { Stamp } from "@/components/ui/Stamp";
import type { FormatProps } from "./types";

/**
 * «Stempelet»: påstanden ligger som et dokument. Spilleren stempler den TULL eller TALL –
 * med knappene eller ved å dra kortet til siden. Avsløringen stempler fasit over.
 */
export function TrueFalse({ q, onSubmit, busy, reveal }: FormatProps<"truefalse">) {
  const reduced = useReducedMotion();
  const serious = q.tone === "serious";
  const [choice, setChoice] = useState<boolean | null>(null);
  const x = useMotionValue(0);
  const rotate = useTransform(x, [-160, 160], [-9, 9]);
  const tullOpacity = useTransform(x, [-120, -30], [1, 0]);
  const tallOpacity = useTransform(x, [30, 120], [0, 1]);

  const answer = reveal ? (reveal.data.payload.format === "truefalse" ? reveal.data.payload.answer : null) : null;
  const correction = reveal && reveal.data.payload.format === "truefalse" ? reveal.data.payload.correction : undefined;
  const choose = (v: boolean) => {
    if (busy || reveal || choice !== null) return;
    setChoice(v);
    if (typeof navigator !== "undefined" && "vibrate" in navigator && !serious) navigator.vibrate?.(18);
    onSubmit({ format: "truefalse", value: v });
  };
  const labelTrue = serious ? t("game.tallHint") : t("game.tall");
  const labelFalse = serious ? t("game.tullHint") : t("game.tull");

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
        className={`relative mx-auto max-w-md bg-papir border-[2.5px] border-blekk rounded-[6px] px-6 pt-9 pb-10 shadow-[6px_7px_0_var(--color-blekk)] ${
          !reveal && choice === null && !reduced ? "cursor-grab active:cursor-grabbing touch-pan-y" : ""
        }`}
      >
        <div aria-hidden className="absolute inset-x-0 top-0 h-3 halftone text-blekk/15 rounded-t" />
        <p className="kicker text-blekk-3 mb-3">Påstand</p>
        <p className="serif-soft text-[1.45rem] sm:text-[1.65rem] leading-[1.22] font-medium">{q.payload.statement}</p>

        {!reveal && !reduced && choice === null ? (
          <>
            <motion.span style={{ opacity: tullOpacity }} className="pointer-events-none absolute left-4 top-4 text-3xl">
              <Stamp color="korall" rotate={-12}>{labelFalse}</Stamp>
            </motion.span>
            <motion.span style={{ opacity: tallOpacity }} className="pointer-events-none absolute right-4 top-4 text-3xl">
              <Stamp color="kobolt" rotate={10}>{labelTrue}</Stamp>
            </motion.span>
          </>
        ) : null}

        {choice !== null && !reveal ? (
          <motion.span
            initial={reduced ? false : { scale: 2.2, opacity: 0, rotate: -20 }}
            animate={{ scale: 1, opacity: 0.55, rotate: choice ? 8 : -10 }}
            transition={{ type: "spring", stiffness: 520, damping: 20 }}
            className="pointer-events-none absolute right-3 bottom-3 text-2xl"
          >
            <Stamp color={choice ? "kobolt" : "korall"} rotate={0}>{choice ? labelTrue : labelFalse}</Stamp>
          </motion.span>
        ) : null}

        {reveal && answer !== null ? (
          <motion.div
            initial={reduced || serious ? { opacity: 0 } : { scale: 2.6, opacity: 0, rotate: -24 }}
            animate={{ scale: 1, opacity: 1, rotate: answer ? 7 : -9 }}
            transition={serious ? { duration: 0.4 } : { type: "spring", stiffness: 600, damping: 16 }}
            className="pointer-events-none absolute -right-2 -bottom-6 sm:-right-6 text-[2.6rem] sm:text-[3.2rem]"
          >
            <Stamp color={answer ? "kobolt" : "korall"} rotate={0} style={{ background: "var(--color-papir)" }}>
              {answer ? labelTrue : labelFalse}
            </Stamp>
          </motion.div>
        ) : null}
      </motion.div>

      {reveal && correction ? (
        <p className="mx-auto max-w-md mt-10 serif-soft italic text-lg border-l-4 border-kobolt pl-4">{correction}</p>
      ) : null}

      {!reveal ? (
        <div className="mt-8 grid grid-cols-2 gap-4 max-w-md mx-auto">
          <button
            type="button"
            disabled={busy || choice !== null}
            onClick={() => choose(false)}
            className={`group relative h-24 rounded-2xl border-[2.5px] border-blekk bg-korall shadow-[4px_4px_0_var(--color-blekk)] active:translate-x-1 active:translate-y-1 active:shadow-none transition-transform ${
              choice === false ? "translate-x-1 translate-y-1 shadow-none" : ""
            }`}
          >
            <span className={`font-black font-wide ${serious ? "text-xl" : "text-[2.1rem]"} leading-none tracking-tight`}>{labelFalse}</span>
            <span className="block kicker mt-1 opacity-80">{serious ? "" : t("game.tullHint")}</span>
          </button>
          <button
            type="button"
            disabled={busy || choice !== null}
            onClick={() => choose(true)}
            className={`group relative h-24 rounded-2xl border-[2.5px] border-blekk bg-kobolt text-papir shadow-[4px_4px_0_var(--color-blekk)] active:translate-x-1 active:translate-y-1 active:shadow-none transition-transform ${
              choice === true ? "translate-x-1 translate-y-1 shadow-none" : ""
            }`}
          >
            <span className={`font-black font-wide ${serious ? "text-xl" : "text-[2.1rem]"} leading-none tracking-tight`}>{labelTrue}</span>
            <span className="block kicker mt-1 opacity-80">{serious ? "" : t("game.tallHint")}</span>
          </button>
          {!reduced ? <p className="col-span-2 text-center kicker text-blekk-3">{t("game.swipeHint")}</p> : null}
        </div>
      ) : null}
    </div>
  );
}
