"use client";
import { motion, useReducedMotion } from "motion/react";
import { useState } from "react";
import { formatValue, t } from "@/lib/i18n";
import { Odometer } from "@/components/ui/Odometer";
import { Stamp } from "@/components/ui/Stamp";
import type { FormatProps } from "./types";

const COLORS = ["bg-kobolt text-papir", "bg-korall text-blekk", "bg-syre text-blekk", "bg-rosa text-blekk"];

/**
 * «Duellen»: alternativene står som tårn. Spilleren trykker på kandidaten sin.
 * Ved avsløring vokser tårnene til sine faktiske verdier – og vinneren får kronestempelet.
 */
export function Compare({ q, onSubmit, busy, reveal }: FormatProps<"compare">) {
  const p = q.payload;
  const reduced = useReducedMotion();
  const [picked, setPicked] = useState<string | null>(null);
  const full = reveal && reveal.data.payload.format === "compare" ? reveal.data.payload : null;
  const values = new Map(full?.items.map((i) => [i.id, i.value]) ?? []);
  const max = full ? Math.max(...full.items.map((i) => Math.abs(i.value))) : 1;
  const winner = (reveal?.detail.winner as string | undefined) ?? null;
  const mine = reveal && reveal.answer.format === "compare" ? reveal.answer.itemId : picked;
  const serious = q.tone === "serious";

  return (
    <div>
      <div className={`grid gap-3 ${p.items.length === 2 ? "grid-cols-2" : p.items.length === 3 ? "grid-cols-3" : "grid-cols-2 sm:grid-cols-4"}`}>
        {p.items.map((item, i) => {
          const v = values.get(item.id);
          const h = v !== undefined ? Math.max(0.06, Math.abs(v) / max) : 0;
          const isWinner = winner === item.id;
          const isMine = mine === item.id;
          return (
            <button
              key={item.id}
              type="button"
              disabled={busy || Boolean(reveal) || picked !== null}
              aria-pressed={isMine}
              onClick={() => {
                setPicked(item.id);
                onSubmit({ format: "compare", itemId: item.id });
              }}
              className={`relative flex flex-col justify-end h-52 sm:h-64 rounded-2xl border-[2.5px] border-blekk bg-papir overflow-hidden text-left shadow-[4px_4px_0_var(--color-blekk)] transition-transform ${
                !reveal && picked === null ? "hover:-translate-y-1 active:translate-y-0" : ""
              } ${isMine && !reveal ? "ring-4 ring-kobolt ring-offset-2 ring-offset-papir" : ""}`}
            >
              {/* Tårnet som vokser */}
              {reveal ? (
                <motion.div
                  initial={{ height: 0 }}
                  animate={{ height: `${h * 100}%` }}
                  transition={reduced ? { duration: 0 } : { delay: 0.25 + i * 0.12, duration: serious ? 0.8 : 1.3, ease: [0.16, 1, 0.3, 1] }}
                  className={`absolute inset-x-0 bottom-0 ${COLORS[i % COLORS.length]} border-t-[2.5px] border-blekk`}
                >
                  <div className="absolute inset-0 halftone-fine opacity-20" aria-hidden />
                </motion.div>
              ) : (
                <div className="absolute inset-x-0 bottom-0 h-1/3 halftone text-blekk/10" aria-hidden />
              )}
              <div className="relative p-3 sm:p-4 bg-papir/0">
                {reveal && v !== undefined ? (
                  <div className="mb-1 font-black text-[clamp(1.1rem,5vw,1.8rem)] leading-none tabular">
                    <span className={`inline-block px-1.5 py-0.5 rounded bg-papir border-2 border-blekk`}>
                      <Odometer value={v} decimals={p.unit.decimals} />
                    </span>
                  </div>
                ) : null}
                {isMine && reveal ? (
                  <span className="mb-1.5 inline-block kicker bg-papir border-2 border-blekk rounded-full px-2 py-0.5">{t("game.youPicked")}</span>
                ) : null}
                <span
                  lang="nb"
                  className={`block font-black font-semi-condensed uppercase leading-[0.95] [overflow-wrap:anywhere] [hyphens:auto] ${
                    p.items.length >= 3 ? "text-[clamp(1rem,4.2vw,1.4rem)]" : "text-[clamp(1.25rem,5.6vw,1.8rem)]"
                  }`}
                >
                  <span className={reveal ? "bg-papir px-1 box-decoration-clone" : ""}>{item.label}</span>
                </span>
                {item.sublabel ? (
                  <span className={`block kicker mt-1 ${reveal ? "bg-papir px-1 w-fit" : "text-blekk-2"}`}>{item.sublabel}</span>
                ) : null}
              </div>
              {isWinner ? (
                <motion.span
                  initial={reduced || serious ? { opacity: 0 } : { scale: 2.4, opacity: 0, rotate: -30 }}
                  animate={{ scale: 1, opacity: 1, rotate: -8 }}
                  transition={{ delay: reduced ? 0 : 1.6, type: "spring", stiffness: 500, damping: 15 }}
                  className="absolute top-2 right-2 text-lg"
                >
                  <Stamp color="syre" rotate={0}>{p.pick === "highest" ? t("game.top") : t("game.bottom")}</Stamp>
                </motion.span>
              ) : null}
            </button>
          );
        })}
      </div>
      {reveal && full ? (
        <p className="sr-only">
          {full.items.map((i) => `${i.label}: ${formatValue(i.value, p.unit)}`).join(", ")}
        </p>
      ) : null}
    </div>
  );
}
