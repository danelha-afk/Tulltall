import type { CSSProperties, ReactNode } from "react";

/**
 * Gummistempel med blekk-tekstur (SVG-filter). Brukes til TULL/TALL og avsløringer.
 */
export function Stamp({
  children,
  color = "korall",
  rotate = -6,
  className = "",
  style,
}: {
  children: ReactNode;
  color?: "korall" | "kobolt" | "blekk" | "syre";
  rotate?: number;
  className?: string;
  style?: CSSProperties;
}) {
  const colors = {
    korall: "text-korall-dyp border-korall",
    kobolt: "text-kobolt border-kobolt",
    blekk: "text-blekk border-blekk",
    syre: "text-blekk border-blekk bg-syre",
  } as const;
  return (
    <span
      className={`inline-block border-[0.12em] rounded-[0.18em] px-[0.35em] pt-[0.1em] pb-[0.02em] font-black font-wide uppercase leading-none tracking-wide ${colors[color]} ${className}`}
      style={{ transform: `rotate(${rotate}deg)`, filter: "url(#stamp-rough)", ...style }}
    >
      {children}
    </span>
  );
}

/** SVG-filtre som brukes på tvers av siden (legges én gang i layout). */
export function InkFilters() {
  return (
    <svg width="0" height="0" aria-hidden focusable="false" className="absolute">
      <filter id="stamp-rough" x="-10%" y="-10%" width="120%" height="120%">
        <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="7" result="noise" />
        <feColorMatrix in="noise" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -1.4 1.25" result="holes" />
        <feComposite in="SourceGraphic" in2="holes" operator="in" result="inked" />
        <feDisplacementMap in="inked" in2="noise" scale="1.2" />
      </filter>
    </svg>
  );
}
