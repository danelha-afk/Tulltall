/**
 * Utvalgsregler som løses opp mot tabellens metadata. Slik slipper katalogen å hardkode
 * alle koder, og endrede tabellstrukturer oppdages i stedet for å gi stille feil.
 */
import type { Dimension } from "./ssb/jsonstat";

export type SelectionRule =
  | { kind: "all" }
  | { kind: "codes"; codes: string[] }
  | { kind: "last"; n: number }
  | { kind: "pattern"; regex: string }
  | { kind: "label"; regex: string }
  | { kind: "total" }
  | { kind: "first" }
  | { kind: "kommuner" };

const TOTAL_LABEL = /^(i alt|alle|begge kjønn|hele landet|totalt|total|alle aldre|alle grupper)/i;
const TOTAL_CODE = /^(0|00|000|TOTAL|T|TOT|999|0+|00-99)$/i;

export class SelectionError extends Error {}

export function resolveRule(dim: Dimension, rule: SelectionRule, ctx: { kommuner?: Set<string> } = {}): string[] {
  switch (rule.kind) {
    case "all":
      return [...dim.codes];
    case "codes": {
      const missing = rule.codes.filter((c) => !dim.codes.includes(c));
      if (missing.length) throw new SelectionError(`${dim.id}: koder finnes ikke lenger (${missing.join(", ")})`);
      return [...rule.codes];
    }
    case "last":
      return dim.codes.slice(-rule.n);
    case "first":
      return dim.codes.slice(0, 1);
    case "pattern": {
      const re = new RegExp(rule.regex);
      const out = dim.codes.filter((c) => re.test(c));
      if (!out.length) throw new SelectionError(`${dim.id}: ingen koder matcher ${rule.regex}`);
      return out;
    }
    case "label": {
      const re = new RegExp(rule.regex, "i");
      const out = dim.codes.filter((c) => re.test(dim.labels[c] ?? ""));
      if (!out.length) throw new SelectionError(`${dim.id}: ingen etiketter matcher ${rule.regex}`);
      return out;
    }
    case "total": {
      const byLabel = dim.codes.find((c) => TOTAL_LABEL.test(dim.labels[c] ?? ""));
      const byCode = dim.codes.find((c) => TOTAL_CODE.test(c));
      const hit = byLabel ?? byCode;
      if (!hit) throw new SelectionError(`${dim.id}: fant ingen totalkode`);
      return [hit];
    }
    case "kommuner": {
      const set = ctx.kommuner;
      if (!set) throw new SelectionError("Kommuneliste mangler");
      const out = dim.codes.filter((c) => set.has(c));
      if (out.length < set.size * 0.9) throw new SelectionError(`${dim.id}: fant bare ${out.length} av ${set.size} gjeldende kommuner`);
      return out;
    }
  }
}

export function resolveSelection(
  dimensions: Dimension[],
  rules: Record<string, SelectionRule>,
  ctx: { kommuner?: Set<string> } = {},
): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const d of dimensions) {
    const rule = rules[d.id];
    if (!rule) {
      // Ikke spesifisert: velg total hvis mulig, ellers første kode – aldri hele dimensjonen i det stille.
      try {
        out[d.id] = resolveRule(d, { kind: "total" }, ctx);
      } catch {
        out[d.id] = resolveRule(d, { kind: "first" }, ctx);
      }
      continue;
    }
    out[d.id] = resolveRule(d, rule, ctx);
  }
  for (const id of Object.keys(rules)) {
    if (!dimensions.some((d) => d.id === id)) throw new SelectionError(`Dimensjonen ${id} finnes ikke lenger i tabellen`);
  }
  return out;
}
