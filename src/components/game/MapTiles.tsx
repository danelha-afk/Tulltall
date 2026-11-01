"use client";
import { motion, useReducedMotion } from "motion/react";
import { useState } from "react";
import { formatNumber, t } from "@/lib/i18n";
import { Stamp } from "@/components/ui/Stamp";
import type { FormatProps } from "./types";

/** Stilisert flisekart over de 15 fylkene (inndeling fra 2024). Én flis per fylke. */
export const FYLKE_TILES: { code: string; abbr: string; name: string; col: number; row: number }[] = [
  { code: "56", abbr: "FI", name: "Finnmark", col: 4, row: 0 },
  { code: "55", abbr: "TR", name: "Troms", col: 3, row: 1 },
  { code: "18", abbr: "NO", name: "Nordland", col: 2, row: 2 },
  { code: "50", abbr: "TL", name: "Trøndelag", col: 2, row: 3 },
  { code: "15", abbr: "MR", name: "Møre og Romsdal", col: 1, row: 4 },
  { code: "34", abbr: "IN", name: "Innlandet", col: 2, row: 4 },
  { code: "46", abbr: "VL", name: "Vestland", col: 0, row: 5 },
  { code: "33", abbr: "BU", name: "Buskerud", col: 1, row: 5 },
  { code: "32", abbr: "AK", name: "Akershus", col: 2, row: 5 },
  { code: "03", abbr: "OS", name: "Oslo", col: 3, row: 5 },
  { code: "11", abbr: "RO", name: "Rogaland", col: 0, row: 6 },
  { code: "40", abbr: "TE", name: "Telemark", col: 1, row: 6 },
  { code: "39", abbr: "VF", name: "Vestfold", col: 2, row: 6 },
  { code: "31", abbr: "ØF", name: "Østfold", col: 3, row: 6 },
  { code: "42", abbr: "AG", name: "Agder", col: 1, row: 7 },
];

const LEVELS = [
  "bg-papir-2 text-blekk",
  "bg-[#c9cbff] text-blekk",
  "bg-[#8f95ff] text-blekk",
  "bg-[#5662ff] text-papir",
  "bg-kobolt-dyp text-papir",
];

/**
 * «Hva ser du?»: et flisekart farget etter et ukjent tall. Spilleren velger hva kartet viser.
 * Ved avsløring snur flisene og viser tallene.
 */
export function MapTiles({ q, onSubmit, busy, reveal }: FormatProps<"map">) {
  const p = q.payload;
  const reduced = useReducedMotion();
  const [picked, setPicked] = useState<string | null>(null);
  const full = reveal && reveal.data.payload.format === "map" ? reveal.data.payload : null;
  const values = new Map(full?.regions.map((r) => [r.code, r.value]) ?? []);
  const level = new Map(p.regions.map((r) => [r.code, r.level]));
  const correctId = (reveal?.detail.correctId as string | undefined) ?? null;
  const mine = reveal && reveal.answer.format === "map" ? reveal.answer.optionId : picked;

  return (
    <div>
      <div className="mx-auto w-full max-w-[16.5rem] rounded-2xl border-[2.5px] border-blekk bg-papir p-3 shadow-[4px_4px_0_var(--color-blekk)]">
        <div className="grid gap-1.5" style={{ gridTemplateColumns: "repeat(5, 1fr)", gridTemplateRows: "repeat(8, auto)" }} role="img" aria-label="Flisekart over fylkene">
          {FYLKE_TILES.map((tile, i) => {
            const lv = level.get(tile.code) ?? 0;
            const v = values.get(tile.code);
            return (
              <motion.div
                key={tile.code}
                title={tile.name}
                initial={false}
                animate={reveal && !reduced ? { rotateY: [0, 90, 0] } : {}}
                transition={{ delay: i * 0.04, duration: 0.5 }}
                className={`aspect-square rounded-md border-2 border-blekk grid place-items-center text-center leading-none ${LEVELS[lv]}`}
                style={{ gridColumn: tile.col + 1, gridRow: tile.row + 1 }}
              >
                <span className="font-black text-[0.7rem]">{tile.abbr}</span>
                {v !== undefined ? <span className="font-mono text-[0.62rem] font-semibold">{formatNumber(v, 0)}</span> : null}
              </motion.div>
            );
          })}
        </div>
        <div className="mt-3 flex items-center gap-2 kicker text-blekk-2" aria-hidden>
          <span>{t("game.mapLegendLow")}</span>
          {LEVELS.map((c) => (
            <span key={c} className={`w-5 h-3 rounded-sm border border-blekk ${c}`} />
          ))}
          <span>{t("game.mapLegendHigh")}</span>
        </div>
      </div>
      <div className="mt-5 grid gap-2.5 max-w-md mx-auto">
        {p.options.map((o, i) => {
          const isCorrect = correctId === o.id;
          const isMine = mine === o.id;
          return (
            <button
              key={o.id}
              type="button"
              disabled={busy || Boolean(reveal) || picked !== null}
              aria-pressed={isMine}
              onClick={() => {
                setPicked(o.id);
                onSubmit({ format: "map", optionId: o.id });
              }}
              className={`relative flex items-center gap-3 text-left rounded-full border-[2.5px] border-blekk pl-2 pr-5 py-2 font-black font-semi-condensed uppercase text-lg shadow-[3px_3px_0_var(--color-blekk)] transition-transform ${
                reveal ? (isCorrect ? "bg-syre" : "bg-papir opacity-70") : "bg-papir hover:-translate-y-0.5"
              } ${isMine && !reveal ? "ring-4 ring-kobolt" : ""}`}
            >
              <span className="grid place-items-center w-8 h-8 rounded-full border-2 border-blekk bg-papir-2 text-sm">{String.fromCharCode(65 + i)}</span>
              {o.label}
              {isMine && reveal ? <span className="ml-auto kicker">{t("game.youPicked")}</span> : null}
              {isCorrect ? (
                <span className="absolute -right-2 -top-3 text-sm">
                  <Stamp color="kobolt" rotate={8}>{t("game.answer")}</Stamp>
                </span>
              ) : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}
