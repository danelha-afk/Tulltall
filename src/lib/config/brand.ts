/**
 * Merkevare og domene. Alt som kan endres uten kodeendring hentes fra miljøvariabler,
 * slik at navn og domene kan byttes hvis tulltall.no ikke er ledig.
 */
export const brand = {
  name: process.env.NEXT_PUBLIC_SITE_NAME ?? "TULL ELLER TALL?",
  shortName: process.env.NEXT_PUBLIC_SITE_SHORT_NAME ?? "Tull eller tall",
  url: (process.env.NEXT_PUBLIC_SITE_URL ?? "https://tulltall.no").replace(/\/$/, ""),
  tagline: process.env.NEXT_PUBLIC_SITE_TAGLINE ?? "Du tror du vet. Men gjør du det?",
  contactEmail: process.env.NEXT_PUBLIC_CONTACT_EMAIL ?? "redaksjon@tulltall.no",
  /** Første dag med publisert daglig runde – brukes til rundenummer (#1, #2 …). */
  launchDate: process.env.NEXT_PUBLIC_LAUNCH_DATE ?? "2026-11-01",
} as const;

export function absoluteUrl(path: string): string {
  return `${brand.url}${path.startsWith("/") ? path : `/${path}`}`;
}
