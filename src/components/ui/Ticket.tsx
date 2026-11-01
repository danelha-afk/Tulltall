import type { ReactNode } from "react";

/** Arkadebilletten – signaturflaten for start og resultat. */
export function Ticket({
  children,
  stub,
  tone = "papir",
  className = "",
}: {
  children: ReactNode;
  stub?: ReactNode;
  tone?: "papir" | "syre" | "kobolt" | "korall";
  className?: string;
}) {
  const bg = {
    papir: "bg-papir text-blekk",
    syre: "bg-syre text-blekk",
    kobolt: "bg-kobolt text-papir",
    korall: "bg-korall text-blekk",
  }[tone];
  return (
    <div className={`relative drop-shadow-[5px_6px_0_var(--color-blekk)] ${className}`}>
      <div className={`ticket ${bg} border-[2.5px] border-blekk rounded-[18px] overflow-hidden`} style={{ background: undefined }}>
        <div className="p-5 sm:p-7">{children}</div>
        {stub ? (
          <>
            <div className="perforation mx-5 opacity-60" aria-hidden />
            <div className="px-5 sm:px-7 py-3">{stub}</div>
          </>
        ) : null}
      </div>
    </div>
  );
}

/** Hullmønster: treff og bom vises som stansede hull – uten å avsløre svarene. */
export function PunchHoles({ pattern, size = 18, current }: { pattern: (boolean | null)[]; size?: number; current?: number }) {
  return (
    <div className="flex flex-wrap gap-1.5" role="img" aria-label={`${pattern.filter(Boolean).length} treff av ${pattern.length}`}>
      {pattern.map((p, i) => (
        <span
          key={i}
          className={`relative inline-block rounded-full border-2 border-blekk transition-all duration-300 ${
            p === true ? "bg-blekk" : p === false ? "bg-papir-3" : "bg-transparent"
          } ${current === i ? "ring-[3px] ring-kobolt ring-offset-2 ring-offset-papir" : ""}`}
          style={{ width: size, height: size }}
        >
          {p === false ? (
            <span className="absolute inset-0 grid place-items-center text-[10px] font-black text-blekk-2 leading-none">×</span>
          ) : null}
        </span>
      ))}
    </div>
  );
}
