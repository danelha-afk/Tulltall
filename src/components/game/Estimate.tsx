"use client";
import { animate, motion, useReducedMotion } from "motion/react";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { formatNumber, formatValue, t } from "@/lib/i18n";
import { Odometer } from "@/components/ui/Odometer";
import { compact, fromPos, logSnap, niceTicks, snap, toPos } from "./scale";
import type { FormatProps } from "./types";

const ZOOM = 5;

/**
 * «Målebåndet»: et langt målebånd glir under en fast nål. Spilleren drar båndet (eller bruker
 * piltaster) til sitt anslag. Ved avsløring ruller båndet videre til fasit, og avstanden markeres.
 */
export function Estimate({ q, onSubmit, busy, reveal }: FormatProps<"estimate">) {
  const p = q.payload;
  const reduced = useReducedMotion();
  const [value, setValue] = useState(p.start);
  const [typing, setTyping] = useState(false);
  const [typed, setTyped] = useState("");
  const [pos, setPos] = useState(toPos(p.start, p.min, p.max, p.scale));
  const wrap = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(320);
  const drag = useRef<{ x: number; pos: number } | null>(null);
  const [zoom, setZoom] = useState(ZOOM);

  useLayoutEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setWidth(el.clientWidth));
    ro.observe(el);
    setWidth(el.clientWidth);
    return () => ro.disconnect();
  }, []);

  const quantize = useCallback(
    (v: number) => (p.scale === "log" ? logSnap(v, p.min, p.max, p.step) : snap(v, p.step, p.min, p.max)),
    [p.scale, p.min, p.max, p.step],
  );

  const setFromPos = (np: number) => {
    const c = Math.min(1, Math.max(0, np));
    setPos(c);
    setValue(quantize(fromPos(c, p.min, p.max, p.scale)));
  };
  const setFromValue = (v: number) => {
    const q2 = quantize(v);
    setValue(q2);
    setPos(toPos(q2, p.min, p.max, p.scale));
  };

  // Avsløring: rull båndet til fasit.
  const answer = reveal && reveal.data.payload.format === "estimate" ? reveal.data.payload.answer : null;
  const guess = reveal && reveal.answer.format === "estimate" ? reveal.answer.value : value;
  // Avsløring: båndet zoomer ut og sentrerer mellom gjetning og fasit, så begge merkene synes.
  useEffect(() => {
    if (answer === null) return;
    const pa = toPos(answer, p.min, p.max, p.scale);
    const pg = toPos(guess, p.min, p.max, p.scale);
    const targetZoom = Math.min(ZOOM, Math.max(1.05, 0.7 / Math.max(Math.abs(pa - pg), 0.04)));
    const targetPos = (pa + pg) / 2;
    if (reduced) {
      setPos(targetPos);
      setZoom(targetZoom);
      return;
    }
    const c1 = animate(pos, targetPos, { duration: 1.6, ease: [0.16, 1, 0.3, 1], onUpdate: setPos });
    const c2 = animate(zoom, targetZoom, { duration: 1.6, ease: [0.16, 1, 0.3, 1], onUpdate: setZoom });
    return () => {
      c1.stop();
      c2.stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [answer]);

  const strip = width * zoom;
  const offset = width / 2 - pos * strip;
  const ticks = niceTicks(p.min, p.max, p.scale, 16);
  const unit = p.unit;
  const isPct = unit.suffix === "%";
  const locked = Boolean(reveal) || busy;

  const onKey = (e: React.KeyboardEvent) => {
    if (locked) return;
    const small = 1 / 400;
    const map: Record<string, number> = { ArrowRight: small, ArrowUp: small, ArrowLeft: -small, ArrowDown: -small, PageUp: small * 20, PageDown: -small * 20 };
    if (e.key in map) {
      e.preventDefault();
      if (p.scale === "linear" && (e.key.startsWith("Arrow"))) setFromValue(value + Math.sign(map[e.key]) * p.step);
      else setFromPos(pos + map[e.key]);
    } else if (e.key === "Home") setFromPos(0);
    else if (e.key === "End") setFromPos(1);
  };

  const diffText = () => {
    if (answer === null) return "";
    const d = Math.abs(guess - answer);
    if (isPct) return t("game.off", { value: `${formatNumber(d, 1)} prosentpoeng` });
    if (p.scale === "log" && answer !== 0) return t("game.offPercent", { value: `${formatNumber((d / Math.abs(answer)) * 100, 0)} %` });
    return t("game.off", { value: formatValue(d, unit) });
  };

  return (
    <div>
      {p.survey ? (
        <p className="kicker inline-block bg-rosa border-2 border-blekk rounded-full px-3 py-1 mb-3">{t("game.surveyBadge")}</p>
      ) : null}

      {/* Stort tall */}
      <div className="text-center my-4" aria-hidden>
        {reveal && answer !== null ? (
          <div>
            <span className="kicker text-kobolt">{t("game.answer")}</span>
            <div className="font-black leading-[0.9] text-[clamp(2.8rem,13vw,5.2rem)] text-kobolt misprint">
              <Odometer value={answer} from={guess} decimals={unit.decimals} prefix={unit.prefix} suffix={unit.suffix === "%" ? " %" : ""} />
            </div>
            {unit.suffix && unit.suffix !== "%" ? <div className="font-bold font-wide uppercase mt-1">{unit.suffix}</div> : null}
          </div>
        ) : (
          <div>
            <span className="kicker text-blekk-3">{t("game.yourGuess")}</span>
            <div
              className="font-black leading-[0.9] text-[clamp(2.8rem,13vw,5.2rem)] tabular transition-[font-stretch] duration-200"
              style={{ fontStretch: drag.current ? "72%" : "100%" }}
            >
              {unit.prefix}
              {formatNumber(value, unit.decimals)}
              {isPct ? " %" : ""}
            </div>
            {unit.suffix && !isPct ? <div className="font-bold font-wide uppercase mt-1">{unit.suffix}</div> : null}
          </div>
        )}
      </div>

      {/* Målebåndet */}
      <div
        ref={wrap}
        role="slider"
        tabIndex={locked ? -1 : 0}
        aria-label={t("game.sliderLabel")}
        aria-valuemin={p.min}
        aria-valuemax={p.max}
        aria-valuenow={value}
        aria-valuetext={formatValue(value, unit)}
        aria-disabled={locked}
        onKeyDown={onKey}
        onPointerDown={(e) => {
          if (locked) return;
          (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
          drag.current = { x: e.clientX, pos };
        }}
        onPointerMove={(e) => {
          if (!drag.current || locked) return;
          setFromPos(drag.current.pos - (e.clientX - drag.current.x) / strip);
        }}
        onPointerUp={() => (drag.current = null)}
        onPointerCancel={() => (drag.current = null)}
        onWheel={(e) => {
          if (locked) return;
          setFromPos(pos + (e.deltaY + e.deltaX) / strip / 2);
        }}
        className={`relative h-28 overflow-hidden rounded-xl border-[2.5px] border-blekk bg-syre select-none touch-none ${
          locked ? "" : "cursor-ew-resize"
        }`}
      >
        <div className="absolute inset-y-0" style={{ width: strip, transform: `translateX(${offset}px)` }}>
          {ticks.map((tk) => {
            const x = toPos(tk.value, p.min, p.max, p.scale) * strip;
            return (
              <div key={tk.value} className="absolute top-0" style={{ left: x }}>
                <div className={`w-[2px] bg-blekk ${tk.major ? "h-9" : "h-5"}`} />
                {tk.major ? (
                  <span className="absolute top-10 -translate-x-1/2 font-mono text-[0.7rem] font-medium whitespace-nowrap">
                    {compact(tk.value)}
                  </span>
                ) : null}
              </div>
            );
          })}
          {/* Fine millimeterstreker */}
          <div
            className="absolute top-0 left-0 right-0 h-3 opacity-50"
            style={{ backgroundImage: "linear-gradient(90deg, var(--color-blekk) 1px, transparent 1px)", backgroundSize: `${strip / 200}px 100%` }}
          />
          {reveal ? (
            <>
              <Marker x={toPos(guess, p.min, p.max, p.scale) * strip} color="korall" label={t("game.yourGuess")} />
              {answer !== null ? <Marker x={toPos(answer, p.min, p.max, p.scale) * strip} color="kobolt" label={t("game.answer")} /> : null}
              {answer !== null ? (
                <motion.div
                  initial={{ scaleX: 0 }}
                  animate={{ scaleX: 1 }}
                  transition={{ delay: reduced ? 0 : 1.2, duration: 0.5 }}
                  className="absolute bottom-3 h-2 origin-left halftone text-korall"
                  style={{
                    left: Math.min(toPos(guess, p.min, p.max, p.scale), toPos(answer, p.min, p.max, p.scale)) * strip,
                    width: Math.abs(toPos(guess, p.min, p.max, p.scale) - toPos(answer, p.min, p.max, p.scale)) * strip,
                  }}
                />
              ) : null}
            </>
          ) : null}
        </div>
        {/* Den faste nålen */}
        {!reveal ? (
          <div className="pointer-events-none absolute inset-y-0 left-1/2 -translate-x-1/2 flex flex-col items-center">
            <div className="w-0 h-0 border-x-[10px] border-x-transparent border-t-[14px] border-t-korall" />
            <div className="w-[3px] flex-1 bg-korall" />
          </div>
        ) : null}
        <div className="pointer-events-none absolute inset-y-0 left-0 w-10 bg-gradient-to-r from-syre to-transparent" />
        <div className="pointer-events-none absolute inset-y-0 right-0 w-10 bg-gradient-to-l from-syre to-transparent" />
      </div>

      {!reveal ? (
        <>
          <p className="text-center mt-2 text-blekk-2 font-semibold">{t("game.estimateHint")}</p>
          <div className="mt-4 flex items-center justify-center gap-3">
            <button type="button" className="btn btn-ghost !w-16 !h-16 !px-0 text-3xl" aria-label="Mindre" disabled={locked} onClick={() => (p.scale === "log" ? setFromPos(pos - 1 / 200) : setFromValue(value - p.step))}>
              −
            </button>
            {typing ? (
              <form
                className="flex items-center gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  const n = Number(typed.replace(/\s/g, "").replace(",", "."));
                  if (Number.isFinite(n)) setFromValue(n);
                  setTyping(false);
                }}
              >
                <label className="sr-only" htmlFor={`type-${q.id}`}>
                  {t("game.typeLabel", { unit: unit.suffix || "tall" })}
                </label>
                <input
                  id={`type-${q.id}`}
                  autoFocus
                  inputMode="decimal"
                  className="w-36 h-12 rounded-full border-[2.5px] border-blekk px-4 font-bold tabular bg-papir"
                  value={typed}
                  onChange={(e) => setTyped(e.target.value)}
                  onBlur={() => {
                    const n = Number(typed.replace(/\s/g, "").replace(",", "."));
                    if (typed && Number.isFinite(n)) setFromValue(n);
                    setTyping(false);
                  }}
                />
              </form>
            ) : (
              <button type="button" className="text-sm font-semibold underline underline-offset-4 px-2 text-blekk-2" onClick={() => { setTyped(String(value)); setTyping(true); }}>
                {t("game.typeInstead")}
              </button>
            )}
            <button type="button" className="btn btn-ghost !w-16 !h-16 !px-0 text-3xl" aria-label="Større" disabled={locked} onClick={() => (p.scale === "log" ? setFromPos(pos + 1 / 200) : setFromValue(value + p.step))}>
              +
            </button>
          </div>
          <div className="mt-6 flex justify-center">
            <button type="button" className="btn btn-primary min-w-56 text-xl !min-h-14" disabled={locked} onClick={() => onSubmit({ format: "estimate", value })}>
              {t("game.lockIn")}
            </button>
          </div>
        </>
      ) : (
        <motion.p
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: reduced ? 0 : 1.4 }}
          className="text-center mt-4 font-black font-wide uppercase text-lg"
        >
          {reveal.points >= 95 ? t("game.spotOn") : diffText()}
        </motion.p>
      )}
    </div>
  );
}

function Marker({ x, color, label }: { x: number; color: "korall" | "kobolt"; label: string }) {
  return (
    <div className="absolute top-0 bottom-0 flex flex-col items-center -translate-x-1/2" style={{ left: x }}>
      <div className={`w-[3px] h-full ${color === "korall" ? "bg-korall" : "bg-kobolt"}`} />
      <span
        className={`absolute bottom-1 kicker whitespace-nowrap px-1.5 py-0.5 rounded border-2 border-blekk ${
          color === "korall" ? "bg-korall text-blekk -translate-y-6" : "bg-kobolt text-papir"
        }`}
      >
        {label}
      </span>
    </div>
  );
}
