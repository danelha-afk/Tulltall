"use client";
import { useEffect, useState } from "react";
import { t } from "@/lib/i18n";

/**
 * Logotypen: TULL og TALL deler alt unntatt én bokstav. Bokstaven vipper mellom U og A
 * som et splitflapp-skilt – identiteten i én bevegelse.
 */
export function Logo({ size = "md", animate = true }: { size?: "sm" | "md" | "xl"; animate?: boolean }) {
  const [flip, setFlip] = useState(false);
  useEffect(() => {
    if (!animate) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) return;
    const id = setInterval(() => setFlip((f) => !f), 2600);
    return () => clearInterval(id);
  }, [animate]);

  const scale = size === "xl" ? "text-[clamp(3.6rem,17vw,8.5rem)]" : size === "md" ? "text-[2.1rem]" : "text-[1.35rem]";
  return (
    <span role="img" className={`relative inline-flex flex-col leading-[0.82] font-black font-wide uppercase select-none ${scale}`} aria-label="TULL ELLER TALL?">
      <span aria-hidden className="flex items-baseline">
        T<Flap a="U" b="A" flipped={flip} />LL
      </span>
      <span aria-hidden className="serif-soft font-normal italic lowercase text-[0.32em] tracking-normal -my-[0.02em] ml-[0.9em] text-kobolt">
        {t("brand.eller")}
      </span>
      <span aria-hidden className="flex items-baseline">
        T<Flap a="A" b="U" flipped={flip} />LL
        <span className="ml-[0.06em] inline-grid place-items-center rounded-full bg-korall text-blekk w-[0.78em] h-[0.78em] text-[0.62em] -translate-y-[0.08em] rotate-[8deg] border-[0.06em] border-blekk">
          ?
        </span>
      </span>
    </span>
  );
}

function Flap({ a, b, flipped }: { a: string; b: string; flipped: boolean }) {
  return (
    <span className="relative inline-block [perspective:400px] w-[0.78em] text-center" style={{ height: "0.82em" }}>
      <span
        className="absolute inset-0 transition-transform duration-500 [transform-style:preserve-3d] ease-[cubic-bezier(.3,1.4,.5,1)]"
        style={{ transform: flipped ? "rotateX(180deg)" : "rotateX(0deg)" }}
      >
        <span className="absolute inset-0 [backface-visibility:hidden] text-kobolt">{a}</span>
        <span className="absolute inset-0 [backface-visibility:hidden] [transform:rotateX(180deg)] text-korall">{b}</span>
      </span>
    </span>
  );
}

export function LogoMark({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex items-center rounded-[0.35em] bg-kobolt text-papir font-black font-wide border-2 border-blekk px-1.5 leading-none ${className}`} aria-hidden>
      T<span className="text-syre">?</span>LL
    </span>
  );
}
