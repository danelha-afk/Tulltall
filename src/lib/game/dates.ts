import { market } from "../config/market";

/** Dato (YYYY-MM-DD) i markedets tidssone – en ny runde starter ved midnatt norsk tid. */
export function localDate(d: Date = new Date(), timeZone = market.timeZone): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(d);
  const get = (t: string) => parts.find((p) => p.type === t)!.value;
  return `${get("year")}-${get("month")}-${get("day")}`;
}

export function addDays(date: string, days: number): string {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function daysBetween(a: string, b: string): number {
  return Math.round((Date.parse(`${b}T12:00:00Z`) - Date.parse(`${a}T12:00:00Z`)) / 86_400_000);
}

export function isIsoDate(s: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(`${s}T12:00:00Z`));
}

/** ISO-uke, f.eks. "2026-W44" (brukes i Nabokrigens ukeskonkurranser). */
export function isoWeek(date: string): string {
  const d = new Date(`${date}T12:00:00Z`);
  const day = (d.getUTCDay() + 6) % 7; // mandag = 0
  d.setUTCDate(d.getUTCDate() - day + 3); // torsdag i samme uke
  const firstThursday = new Date(Date.UTC(d.getUTCFullYear(), 0, 4));
  const week = 1 + Math.round(((d.getTime() - firstThursday.getTime()) / 86_400_000 - 3 + ((firstThursday.getUTCDay() + 6) % 7)) / 7);
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

/** Mandag og søndag (YYYY-MM-DD) for uken en dato tilhører. */
export function weekRange(date: string): { start: string; end: string } {
  const d = new Date(`${date}T12:00:00Z`);
  const day = (d.getUTCDay() + 6) % 7;
  const start = addDays(date, -day);
  return { start, end: addDays(start, 6) };
}

/** Millisekunder til neste midnatt i markedets tidssone. */
export function msUntilNextRound(now: Date = new Date()): number {
  const today = localDate(now);
  const tomorrow = addDays(today, 1);
  // Finn UTC-tidspunktet for midnatt lokal tid ved å prøve offset −14..+14 t.
  for (let h = -14; h <= 14; h++) {
    const candidate = new Date(Date.parse(`${tomorrow}T00:00:00Z`) - h * 3_600_000);
    if (localDate(candidate) === tomorrow && localDate(new Date(candidate.getTime() - 1000)) === today) {
      return Math.max(0, candidate.getTime() - now.getTime());
    }
  }
  return 24 * 3_600_000;
}

export function roundNumber(date: string, launchDate: string): number {
  return Math.max(1, daysBetween(launchDate, date) + 1);
}
