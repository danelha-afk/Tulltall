import { brand } from "@/lib/config/brand";

/**
 * Adressen vi deler. Alltid hoveddomenet (f.eks. tulltall.no), aldri en midlertidig vercel.app-adresse –
 * lange tilfeldige adresser ser ut som svindel i en melding. Lokalt (utvikling og tester) brukes adressen du sitter på.
 */
export function shareOrigin(): string {
  if (typeof window === "undefined") return brand.url;
  const host = window.location.hostname;
  const local = host === "localhost" || host === "127.0.0.1" || host === "[::1]" || host.endsWith(".local");
  return local ? window.location.origin : brand.url;
}

/** Full delelenke for en sti som «/u/k7m2xq». Ingen sporingsparametre. */
export function shareUrl(path: string): string {
  return `${shareOrigin()}${path.startsWith("/") ? path : `/${path}`}`;
}

/** Pen visning uten https:// – «tulltall.no/u/k7m2xq». */
export function prettyUrl(url: string): string {
  return url.replace(/^https?:\/\//, "").replace(/\/$/, "");
}
