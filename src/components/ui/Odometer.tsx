"use client";
import { useEffect, useRef, useState } from "react";
import { formatNumber } from "@/lib/i18n";

/**
 * Stort, rullende tall: teller opp med akselerasjon og bremser inn mot riktig verdi.
 * Bredden «puster» (font-stretch) mens tallet ruller.
 */
export function Odometer({
  value,
  decimals = 0,
  duration = 1400,
  from = 0,
  className = "",
  prefix = "",
  suffix = "",
  play = true,
}: {
  value: number;
  decimals?: number;
  duration?: number;
  from?: number;
  className?: string;
  prefix?: string;
  suffix?: string;
  play?: boolean;
}) {
  const [shown, setShown] = useState(play ? from : value);
  const [moving, setMoving] = useState(false);
  const raf = useRef<number | null>(null);

  useEffect(() => {
    if (!play) {
      setShown(value);
      return;
    }
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      setShown(value);
      return;
    }
    const start = performance.now();
    setMoving(true);
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - p, 4);
      setShown(from + (value - from) * eased);
      if (p < 1) raf.current = requestAnimationFrame(tick);
      else setMoving(false);
    };
    raf.current = requestAnimationFrame(tick);
    return () => {
      if (raf.current) cancelAnimationFrame(raf.current);
    };
  }, [value, from, duration, play]);

  return (
    <span
      className={`tabular inline-block transition-[font-stretch] duration-300 ${className}`}
      style={{ fontStretch: moving ? "70%" : "100%" }}
      aria-live="polite"
    >
      {prefix}
      {formatNumber(shown, decimals)}
      {suffix}
    </span>
  );
}
