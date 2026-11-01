/**
 * Enkel, typet internasjonalisering. Alle UI-tekster ligger i meldingskataloger per språk
 * (messages/nb.ts …) – aldri hardkodet i komponentene. Spørsmålsinnhold er separat (databasen).
 */
import { nb } from "./messages/nb";

export type Messages = typeof nb;
export type Locale = "nb";

const catalogs: Record<Locale, Messages> = { nb };

type Leaves<T, P extends string = ""> = {
  [K in keyof T & string]: T[K] extends string ? `${P}${K}` : T[K] extends Record<string, unknown> ? Leaves<T[K], `${P}${K}.`> : never;
}[keyof T & string];

export type MessageKey = Leaves<Messages>;
export type Vars = Record<string, string | number>;

function lookup(messages: Messages, key: string): string {
  let cur: unknown = messages;
  for (const part of key.split(".")) {
    if (cur && typeof cur === "object" && part in (cur as Record<string, unknown>)) {
      cur = (cur as Record<string, unknown>)[part];
    } else {
      return key;
    }
  }
  return typeof cur === "string" ? cur : key;
}

export function interpolate(template: string, vars?: Vars): string {
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (m, name: string) => (name in vars ? String(vars[name]) : m));
}

export type Translator = ((key: MessageKey, vars?: Vars) => string) & {
  /** Flertall: bruker `${key}_one` / `${key}_other` etter Intl.PluralRules. */
  plural: (key: string, count: number, vars?: Vars) => string;
  locale: Locale;
  formatNumber: (n: number, decimals?: number) => string;
};

export function getTranslator(locale: Locale = "nb"): Translator {
  const messages = catalogs[locale];
  const rules = new Intl.PluralRules(locale === "nb" ? "nb-NO" : locale);
  const t = ((key: MessageKey, vars?: Vars) => interpolate(lookup(messages, key), vars)) as Translator;
  t.plural = (key, count, vars) => {
    const form = rules.select(count) === "one" ? "one" : "other";
    return interpolate(lookup(messages, `${key}_${form}`), { count: formatNumber(count, 0, locale), ...vars });
  };
  t.locale = locale;
  t.formatNumber = (n, decimals = 0) => formatNumber(n, decimals, locale);
  return t;
}

export function formatNumber(n: number, decimals = 0, locale: Locale = "nb"): string {
  return new Intl.NumberFormat(locale === "nb" ? "nb-NO" : locale, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })
    .format(n)
    .replace(/ /g, " "); // smal hardt mellomrom som tusenskille
}

export function formatValue(n: number, unit: { prefix?: string; suffix?: string; decimals?: number }, locale: Locale = "nb"): string {
  const num = formatNumber(n, unit.decimals ?? 0, locale);
  const suffix = unit.suffix ? (unit.suffix === "%" ? " %" : ` ${unit.suffix}`) : "";
  return `${unit.prefix ?? ""}${num}${suffix}`;
}

export const t = getTranslator("nb");
