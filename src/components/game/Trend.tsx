"use client";
import { motion, useReducedMotion } from "motion/react";
import { useRef, useState } from "react";
import { formatNumber, formatValue, t } from "@/lib/i18n";
import { snap } from "./scale";
import type { FormatProps } from "./types";

const W = 340;
const H = 240;
const PAD = { l: 44, r: 22, t: 18, b: 30 };

/**
 * «Tidsmaskinen»: kjente år er tegnet; spilleren drar endepunktet til der hen tror kurven ender.
 * Ved avsløring tegner den virkelige kurven seg gjennom årene spilleren ikke så.
 */
export function Trend({ q, onSubmit, busy, reveal }: FormatProps<"trend">) {
  const p = q.payload;
  const reduced = useReducedMotion();
  const lastKnown = p.known[p.known.length - 1].value;
  const [guess, setGuess] = useState(lastKnown);
  const svgRef = useRef<SVGSVGElement>(null);
  const dragging = useRef(false);
  const full = reveal && reveal.data.payload.format === "trend" ? reveal.data.payload.series : null;
  const finalGuess = reveal && reveal.answer.format === "trend" ? reveal.answer.value : guess;

  const n = p.periods.length;
  const x = (i: number) => PAD.l + (i / (n - 1)) * (W - PAD.l - PAD.r);
  const y = (v: number) => PAD.t + (1 - (v - p.min) / (p.max - p.min)) * (H - PAD.t - PAD.b);
  const vFromY = (py: number) => p.min + (1 - (py - PAD.t) / (H - PAD.t - PAD.b)) * (p.max - p.min);
  const knownPath = p.known.map((pt, i) => `${i === 0 ? "M" : "L"}${x(i)},${y(pt.value)}`).join(" ");
  const realTail = full
    ? full
        .slice(p.known.length - 1)
        .map((pt, i) => `${i === 0 ? "M" : "L"}${x(i + p.known.length - 1)},${y(pt.value)}`)
        .join(" ")
    : "";
  const locked = busy || Boolean(reveal);
  const gridValues = [0, 0.25, 0.5, 0.75, 1].map((f) => p.min + f * (p.max - p.min));

  const updateFromPointer = (clientY: number) => {
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const py = ((clientY - rect.top) / rect.height) * H;
    setGuess(snap(vFromY(py), p.step, p.min, p.max));
  };

  const onKey = (e: React.KeyboardEvent) => {
    if (locked) return;
    const big = (p.max - p.min) / 20;
    const d: Record<string, number> = { ArrowUp: p.step, ArrowRight: p.step, ArrowDown: -p.step, ArrowLeft: -p.step, PageUp: big, PageDown: -big };
    if (e.key in d) {
      e.preventDefault();
      setGuess((g) => snap(g + d[e.key], p.step, p.min, p.max));
      }
  };

  const lastPeriod = p.periods[n - 1];
  const fmt = (v: number) => formatValue(v, p.unit);

  return (
    <div>
      <p className="text-center kicker text-blekk-2 mb-3">{p.indicator}</p>
      <div className="relative rounded-2xl border-[2.5px] border-blekk bg-papir shadow-[4px_4px_0_var(--color-blekk)] overflow-hidden">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${W} ${H}`}
          className="w-full h-auto block touch-none select-none"
          role="slider"
          tabIndex={locked ? -1 : 0}
          aria-orientation="vertical"
          aria-label={t("game.trendHint", { period: lastPeriod })}
          aria-valuemin={p.min}
          aria-valuemax={p.max}
          aria-valuenow={guess}
          aria-valuetext={fmt(guess)}
          onKeyDown={onKey}
          onPointerDown={(e) => {
            if (locked) return;
            dragging.current = true;
            (e.target as Element).setPointerCapture?.(e.pointerId);
            updateFromPointer(e.clientY);
          }}
          onPointerMove={(e) => dragging.current && !locked && updateFromPointer(e.clientY)}
          onPointerUp={() => (dragging.current = false)}
          onPointerCancel={() => (dragging.current = false)}
        >
          <defs>
            <pattern id={`dots-${q.id}`} width="6" height="6" patternUnits="userSpaceOnUse">
              <circle cx="3" cy="3" r="1.1" fill="var(--color-kobolt)" opacity="0.35" />
            </pattern>
          </defs>
          {gridValues.map((v) => (
            <g key={v}>
              <line x1={PAD.l} x2={W - PAD.r} y1={y(v)} y2={y(v)} stroke="var(--color-blekk)" strokeOpacity="0.12" strokeDasharray="2 4" />
              <text x={PAD.l - 6} y={y(v) + 3} textAnchor="end" className="font-mono" fontSize="9" fill="var(--color-blekk-2)">
                {formatNumber(v, p.unit.decimals > 0 && p.max - p.min < 5 ? p.unit.decimals : 0)}
              </text>
            </g>
          ))}
          {p.periods.map((per, i) => (
            <text key={per} x={x(i)} y={H - 10} textAnchor="middle" className="font-mono" fontSize="9" fill={i < p.known.length || reveal ? "var(--color-blekk)" : "var(--color-blekk-3)"}>
              {per}
            </text>
          ))}
          {/* Skjulte år */}
          {!reveal
            ? p.periods.slice(p.known.length, n - 1).map((per, k) => (
                <text key={per} x={x(p.known.length + k)} y={y((p.min + p.max) / 2)} textAnchor="middle" fontSize="16" fontWeight="900" fill="var(--color-blekk-3)">
                  ?
                </text>
              ))
            : null}
          {/* Område under kjent kurve */}
          <path d={`${knownPath} L${x(p.known.length - 1)},${y(p.min)} L${x(0)},${y(p.min)} Z`} fill={`url(#dots-${q.id})`} />
          <path d={knownPath} fill="none" stroke="var(--color-blekk)" strokeWidth="3.5" strokeLinejoin="round" strokeLinecap="round" />
          {p.known.map((pt, i) => (
            <circle key={pt.period} cx={x(i)} cy={y(pt.value)} r="4.5" fill="var(--color-papir)" stroke="var(--color-blekk)" strokeWidth="2.5" />
          ))}
          {/* Gjetningen */}
          <line
            x1={x(p.known.length - 1)}
            y1={y(lastKnown)}
            x2={x(n - 1)}
            y2={y(finalGuess)}
            stroke="var(--color-korall)"
            strokeWidth="3"
            strokeDasharray="6 6"
            strokeLinecap="round"
          />
          {/* Den virkelige kurven */}
          {full ? (
            <motion.path
              d={realTail}
              fill="none"
              stroke="var(--color-kobolt)"
              strokeWidth="4.5"
              strokeLinejoin="round"
              strokeLinecap="round"
              initial={{ pathLength: reduced ? 1 : 0 }}
              animate={{ pathLength: 1 }}
              transition={{ duration: reduced ? 0 : 1.8, ease: [0.45, 0, 0.2, 1] }}
            />
          ) : null}
          {full
            ? full.slice(p.known.length).map((pt, k) => (
                <motion.circle
                  key={pt.period}
                  cx={x(p.known.length + k)}
                  cy={y(pt.value)}
                  r="5"
                  fill="var(--color-kobolt)"
                  stroke="var(--color-blekk)"
                  strokeWidth="2"
                  initial={{ scale: reduced ? 1 : 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: reduced ? 0 : 0.4 + (k / Math.max(1, full.length - p.known.length)) * 1.5 }}
                />
              ))
            : null}
          {/* Håndtak */}
          <g transform={`translate(${x(n - 1)}, ${y(finalGuess)})`}>
            <circle r="13" fill="var(--color-korall)" stroke="var(--color-blekk)" strokeWidth="2.5" className={locked ? "" : "cursor-ns-resize"} />
            {!locked ? <path d="M-4 -3 L0 -7 L4 -3 M-4 3 L0 7 L4 3" stroke="var(--color-blekk)" strokeWidth="2" fill="none" /> : null}
          </g>
          {full ? (
            <motion.g initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: reduced ? 0 : 1.7 }}>
              <rect x={x(n - 1) - 66} y={y(full[n - 1].value) - 34} width="62" height="22" rx="4" fill="var(--color-kobolt)" stroke="var(--color-blekk)" strokeWidth="2" />
              <text x={x(n - 1) - 35} y={y(full[n - 1].value) - 19} textAnchor="middle" fontSize="11" fontWeight="800" fill="var(--color-papir)">
                {formatNumber(full[n - 1].value, p.unit.decimals)}
              </text>
            </motion.g>
          ) : null}
        </svg>
        {!reveal ? (
          <div className="absolute top-2 right-3 text-right">
            <span className="kicker block text-blekk-3">{lastPeriod}</span>
            <span className="font-black text-2xl tabular text-korall-dyp misprint-blue">{fmt(guess)}</span>
          </div>
        ) : null}
      </div>
      {!reveal ? (
        <>
          <p className="text-center mt-2 text-blekk-2 font-semibold">{t("game.trendHint", { period: lastPeriod })}</p>
          <div className="mt-5 flex justify-center">
            <button type="button" className="btn btn-primary min-w-56 text-xl !min-h-14" disabled={locked} onClick={() => onSubmit({ format: "trend", value: guess })}>
              {t("game.lockIn")}
            </button>
          </div>
        </>
      ) : (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: reduced ? 0 : 1.9 }} className="text-center mt-4">
          <p className="font-black font-wide uppercase text-lg">
            {t("game.yourGuess")}: {fmt(finalGuess)} · {t("game.answer")}: {full ? fmt(full[n - 1].value) : ""}
          </p>
          <p className="serif-soft italic mt-1">
            {reveal.detail.directionCorrect ? t("game.trendDirectionRight") : t("game.trendDirectionWrong")}
          </p>
          <p className="sr-only">{full?.map((pt) => `${pt.period}: ${fmt(pt.value)}`).join(", ")}</p>
        </motion.div>
      )}
    </div>
  );
}
