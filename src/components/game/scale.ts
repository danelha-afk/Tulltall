/** Hjelpefunksjoner for skalaer (lineær og logaritmisk) og «pene» merker. */

export function toPos(v: number, min: number, max: number, scale: "linear" | "log"): number {
  if (scale === "log") return (Math.log(v) - Math.log(min)) / (Math.log(max) - Math.log(min));
  return (v - min) / (max - min);
}

export function fromPos(p: number, min: number, max: number, scale: "linear" | "log"): number {
  const c = Math.min(1, Math.max(0, p));
  if (scale === "log") return Math.exp(Math.log(min) + c * (Math.log(max) - Math.log(min)));
  return min + c * (max - min);
}

export function snap(v: number, step: number, min: number, max: number): number {
  const s = Math.round(v / step) * step;
  const d = (String(step).split(".")[1] ?? "").length;
  return Math.min(max, Math.max(min, Number(s.toFixed(d))));
}

/** «Pent» steg for log-skala: tre gjeldende siffer. */
export function logSnap(v: number, min: number, max: number, step: number): number {
  if (v <= 0) return min;
  const mag = Math.pow(10, Math.floor(Math.log10(v)) - 2);
  const s = Math.max(step, mag);
  return snap(v, s, min, max);
}

export function niceTicks(min: number, max: number, scale: "linear" | "log", count = 10): { value: number; major: boolean }[] {
  const ticks: { value: number; major: boolean }[] = [];
  if (scale === "log") {
    const lo = Math.floor(Math.log10(min));
    const hi = Math.ceil(Math.log10(max));
    for (let e = lo; e <= hi; e++) {
      for (const m of [1, 2, 3, 5, 7]) {
        const v = m * Math.pow(10, e);
        if (v >= min && v <= max) ticks.push({ value: v, major: m === 1 || m === 5 });
      }
    }
    return ticks;
  }
  const span = max - min;
  const raw = span / count;
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const norm = raw / mag;
  const step = (norm < 1.5 ? 1 : norm < 3 ? 2 : norm < 7 ? 5 : 10) * mag;
  const first = Math.ceil(min / step) * step;
  for (let v = first, i = 0; v <= max + 1e-9; v += step, i++) {
    const major = Math.round(v / step) % 2 === 0;
    ticks.push({ value: Number(v.toFixed(10)), major });
    // mellommerker
    const half = v + step / 2;
    if (half < max) ticks.push({ value: Number(half.toFixed(10)), major: false });
  }
  return ticks.sort((a, b) => a.value - b.value);
}

export function compact(n: number): string {
  const abs = Math.abs(n);
  const f = (x: number, suffix: string) => `${Number(x.toFixed(x < 10 ? 1 : 0)).toLocaleString("nb-NO")}${suffix}`;
  if (abs >= 1e9) return f(n / 1e9, " mrd");
  if (abs >= 1e6) return f(n / 1e6, " mill");
  if (abs >= 1e4) return f(n / 1e3, "k");
  return Number(n.toFixed(2)).toLocaleString("nb-NO");
}
