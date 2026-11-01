/** Små, egentegnede symboler for hvert spillformat (ingen generiske ikoner). */
export function FormatGlyph({ format }: { format: string }) {
  const common = "w-full h-20 rounded-xl border-2 border-blekk overflow-hidden relative";
  switch (format) {
    case "truefalse":
      return (
        <div className={`${common} bg-papir-2 grid grid-cols-2`}>
          <span className="grid place-items-center font-black font-wide text-korall-dyp text-xl -rotate-6" style={{ filter: "url(#stamp-rough)" }}>TULL</span>
          <span className="grid place-items-center font-black font-wide text-kobolt text-xl rotate-6" style={{ filter: "url(#stamp-rough)" }}>TALL</span>
        </div>
      );
    case "estimate":
      return (
        <div className={`${common} bg-syre`}>
          <div className="absolute inset-x-0 top-0 h-6" style={{ backgroundImage: "linear-gradient(90deg, var(--color-blekk) 2px, transparent 2px)", backgroundSize: "12px 100%" }} />
          <div className="absolute left-1/2 top-0 bottom-0 w-[3px] bg-korall" />
          <span className="absolute bottom-1 left-1/2 -translate-x-1/2 font-black text-2xl tabular">483 631</span>
        </div>
      );
    case "compare":
      return (
        <div className={`${common} bg-papir flex items-end gap-2 px-4`}>
          <span className="flex-1 h-[45%] bg-korall border-2 border-blekk border-b-0" />
          <span className="flex-1 h-[90%] bg-kobolt border-2 border-blekk border-b-0" />
          <span className="flex-1 h-[65%] bg-syre border-2 border-blekk border-b-0" />
        </div>
      );
    case "rank":
      return (
        <div className={`${common} bg-papir-2 flex flex-col justify-center gap-1 px-3`}>
          {[1, 2, 3].map((n) => (
            <span key={n} className="flex items-center gap-2 bg-papir border-2 border-blekk rounded px-2 text-xs font-black" style={{ transform: `rotate(${n % 2 ? -1 : 1}deg)` }}>
              <span className="text-kobolt">{n}</span>
              <span className="flex-1 h-1.5 bg-blekk/20 rounded" />
            </span>
          ))}
        </div>
      );
    case "trend":
      return (
        <div className={`${common} bg-papir`}>
          <svg viewBox="0 0 120 60" className="w-full h-full" aria-hidden>
            <path d="M8 12 L40 20 L62 38" fill="none" stroke="var(--color-blekk)" strokeWidth="4" strokeLinecap="round" />
            <path d="M62 38 L110 46" fill="none" stroke="var(--color-kobolt)" strokeWidth="4" strokeLinecap="round" />
            <path d="M62 38 L110 18" fill="none" stroke="var(--color-korall)" strokeWidth="3" strokeDasharray="5 5" />
            <circle cx="110" cy="18" r="6" fill="var(--color-korall)" stroke="var(--color-blekk)" strokeWidth="2" />
          </svg>
        </div>
      );
    case "map":
      return (
        <div className={`${common} bg-papir grid grid-cols-6 grid-rows-3 gap-1 p-2`}>
          {[0, 1, 2, 3, 4, 2, 3, 1, 4, 0, 2, 3].map((lv, i) => (
            <span key={i} className={`rounded-sm border border-blekk ${["bg-papir-2", "bg-[#c9cbff]", "bg-[#8f95ff]", "bg-[#5662ff]", "bg-kobolt-dyp"][lv]}`} />
          ))}
        </div>
      );
    default:
      return null;
  }
}
