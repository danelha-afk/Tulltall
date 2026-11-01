/**
 * Deterministisk faktakontroll og redaksjonelle regler. Ingen KI-vurdering kan overstyre disse:
 * feil (errors) blokkerer godkjenning; flagg (flags) tvinger manuell gjennomgang.
 */
import { semanticErrors, type QuestionContent, type Risk } from "../game/schema";
import { correctCompareId, correctRankOrder } from "../game/scoring";
import { daysBetween } from "../game/dates";
import { neutralStart } from "../game/public";

export interface QaResult {
  ok: boolean;
  errors: string[];
  warnings: string[];
  /** Forhold som krever menneskelig vurdering. */
  flags: string[];
  computedRisk: Risk;
  duplicateOf?: string;
}

export interface QaContext {
  existing?: { id: string; prompt: string }[];
  today?: string;
  /** Tillatte tall (fra datamotoren) – brukes for KI-genererte tekster. */
  allowedNumbers?: number[];
  strictNumbers?: boolean;
  staleDays?: number;
}

export const TRUSTED_DOMAINS = [
  "ssb.no",
  "fhi.no",
  "nav.no",
  "bufdir.no",
  "imdi.no",
  "udir.no",
  "regjeringen.no",
  "politiet.no",
  "kripos.no",
  "vegvesen.no",
  "ofv.no",
  "norges-bank.no",
  "kartverket.no",
  "miljodirektoratet.no",
  "landbruksdirektoratet.no",
  "npolar.no",
  "oecd.org",
  "ec.europa.eu",
  "worldbank.org",
  "data.worldbank.org",
  "oslomet.no",
  "ungdata.no",
  "nibio.no",
  "nve.no",
  "statnett.no",
  "olympics.com",
  "nb.no",
  "sprakradet.no",
  "stortinget.no",
  "medietilsynet.no",
  "nrk.no",
  "snl.no",
  "nbim.no",
  "helsedirektoratet.no",
  "ipsos.com",
  "seafood.no",
  "olympiatoppen.no",
  "met.no",
  "norges-bank.no",
  "elbil.no",
  "acea.auto",
  "sdir.no",
  "publikasjoner.nve.no",
  "skatteetaten.no",
  "domstol.no",
];

const SENSITIVE = [
  /kriminal/i,
  /lovbrudd/i,
  /siktel/i,
  /siktet/i,
  /domfel/i,
  /innvandr/i,
  /etnisk/i,
  /religi/i,
  /muslim/i,
  /jød/i,
  /psykisk/i,
  /diskrimin/i,
  /\bvold(?!som)/i,
  /drap/i,
  /selvmord/i,
  /overgrep/i,
  /rasis/i,
  /flyktning/i,
  /asyl/i,
  /dødsfall|dødsårsak|omkom|drept/i,
];

const CAUSAL = [/\bfordi\b/i, /\bskyldes\b/i, /på grunn av/i, /fører til/i, /forårsak/i, /\bårsaken\b/i, /\bbeviser\b/i];
const MORALIZING = [/fordommer/i, /du tok feil/i, /feil av deg/i, /skam/i, /burde vite/i];

export function normalizeText(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9æøå ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function trigrams(s: string): Set<string> {
  const t = ` ${normalizeText(s)} `;
  const out = new Set<string>();
  for (let i = 0; i < t.length - 2; i++) out.add(t.slice(i, i + 3));
  return out;
}

export function similarity(a: string, b: string): number {
  const A = trigrams(a);
  const B = trigrams(b);
  let inter = 0;
  for (const x of A) if (B.has(x)) inter++;
  const union = A.size + B.size - inter;
  return union === 0 ? 0 : inter / union;
}

/** Trekker ut tall fra norsk tekst («1 234,5», «12 %», «2024»). */
export function numbersInText(text: string): number[] {
  const out: number[] = [];
  const re = /(?<![\p{L}\d])(\d{1,3}(?:[   ]\d{3})+|\d+)(?:,(\d+))?/gu;
  for (const m of text.matchAll(re)) {
    const int = m[1].replace(/[   ]/g, "");
    const n = Number(m[2] ? `${int}.${m[2]}` : int);
    if (Number.isFinite(n)) out.push(n);
  }
  return out;
}

function numberAllowed(n: number, allowed: number[]): boolean {
  if (n >= 1900 && n <= 2100 && Number.isInteger(n)) return true; // årstall
  if (n <= 10 && Number.isInteger(n)) return true; // små tellinger («to», «tre»)
  return allowed.some((a) => {
    if (a === n) return true;
    const tol = Math.max(Math.abs(a) * 0.006, 0.051);
    if (Math.abs(a - n) <= tol) return true; // avrunding
    // «1,2 millioner» o.l.
    for (const scale of [1e3, 1e6, 1e9]) if (Math.abs(a / scale - n) <= Math.max(Math.abs(a / scale) * 0.06, 0.051)) return true;
    return false;
  });
}

export function payloadNumbers(q: QuestionContent): number[] {
  const p = q.payload;
  const nums: number[] = [];
  switch (p.format) {
    case "estimate":
      nums.push(p.answer, p.min, p.max);
      break;
    case "compare":
    case "rank":
      nums.push(...p.items.map((i) => i.value));
      break;
    case "trend":
      nums.push(...p.series.map((s) => s.value));
      break;
    case "map":
      nums.push(...p.regions.map((r) => r.value));
      break;
    case "truefalse":
      nums.push(...numbersInText(p.statement), ...numbersInText(p.correction ?? ""));
      break;
  }
  // Avledede størrelser: differanser og forhold mellom alle par i små lister.
  const base = [...nums];
  if (base.length <= 12) {
    for (let i = 0; i < base.length; i++) {
      for (let j = 0; j < base.length; j++) {
        if (i === j) continue;
        nums.push(Math.abs(base[i] - base[j]));
        if (base[j] !== 0) {
          nums.push(base[i] / base[j], ((base[i] - base[j]) / Math.abs(base[j])) * 100);
        }
      }
    }
  }
  return nums;
}

export function computeRisk(q: QuestionContent): Risk {
  const text = [q.prompt, q.topic, ...q.tags, JSON.stringify(q.payload), q.reveal.explanation].join(" ");
  if (SENSITIVE.some((re) => re.test(text))) return "high";
  if (q.calculation || q.payload.format === "trend" || q.category === "misconception") return "medium";
  return "low";
}

const RISK_ORDER: Record<Risk, number> = { low: 0, medium: 1, high: 2 };

export function validateQuestion(q: QuestionContent, ctx: QaContext = {}): QaResult {
  const errors: string[] = [...semanticErrors(q)];
  const warnings: string[] = [];
  const flags: string[] = [];
  const today = ctx.today ?? new Date().toISOString().slice(0, 10);

  // 1. Kilder
  for (const s of q.sources) {
    let host = "";
    try {
      host = new URL(s.url).hostname.replace(/^www\./, "");
    } catch {
      errors.push(`Ugyldig kilde-URL: ${s.url}`);
      continue;
    }
    if (!TRUSTED_DOMAINS.some((d) => host === d || host.endsWith(`.${d}`))) {
      warnings.push(`Kilden ${host} er ikke på listen over primærkilder – vurder en primærkilde`);
    }
    if (s.tableId && !/^\d{5}$/.test(s.tableId)) errors.push(`SSB-tabell-ID må være fem sifre: ${s.tableId}`);
  }
  if (q.verification.method === "secondary-snippet") {
    warnings.push("Tallet er kontrollert mot publisert kildetekst, ikke direkte mot primærtabell");
  }

  // 2. Aktualitet
  const staleDays = ctx.staleDays ?? 548;
  if (daysBetween(q.lastVerified, today) > staleDays) errors.push(`Ikke kontrollert på over ${staleDays} dager`);
  if (q.lastVerified > today) errors.push("Kontrolldato ligger i fremtiden");

  // 3. Risiko – kan aldri settes lavere enn det reglene tilsier
  const computedRisk = computeRisk(q);
  if (RISK_ORDER[q.risk] < RISK_ORDER[computedRisk]) {
    errors.push(`Risiko er satt til ${q.risk}, men innholdet tilsier minst ${computedRisk}`);
  }
  if (q.risk === "high" || computedRisk === "high") flags.push("høy redaksjonell risiko – manuell godkjenning");

  // 4. Konklusjoner som går lenger enn data
  const prose = [q.prompt, q.reveal.headline, q.reveal.explanation, q.reveal.deepDive ?? ""].join(" ");
  if (!q.tags.includes("metode") && CAUSAL.some((re) => re.test(prose))) {
    flags.push("årsaksspråk – kontroller at teksten ikke antyder årsakssammenheng uten belegg");
  }
  if (MORALIZING.some((re) => re.test(prose))) errors.push("Moraliserende formulering – omformuler nysgjerrig og inviterende");
  if (/\bmyte/i.test(prose) && !q.tags.includes("dokumentert-oppfatning")) {
    errors.push("Teksten kaller noe en myte uten dokumentasjon på at oppfatningen er utbredt");
  }

  // 5. Formatspesifikt
  const p = q.payload;
  if (p.format === "estimate") {
    if (neutralStart(p) === p.answer) errors.push("Kontrollens startverdi er lik fasit");
    if (p.answer === p.min || p.answer === p.max) warnings.push("Fasit ligger helt i ytterkant av skalaen");
  }
  if (p.format === "trend") {
    const periods = p.series.map((s) => s.period);
    if (periods.some((x, i) => i > 0 && x <= periods[i - 1])) errors.push("Perioder i tidsserien må være stigende");
  }
  if (p.format === "compare") correctCompareId(p);
  if (p.format === "rank") correctRankOrder(p);
  if ("unit" in p && p.unit.suffix === "%") {
    const vals =
      p.format === "compare" || p.format === "rank"
        ? p.items.map((i) => i.value)
        : p.format === "trend"
          ? p.series.map((s) => s.value)
          : p.format === "estimate"
            ? [p.answer]
            : p.format === "map"
              ? p.regions.map((r) => r.value)
              : [];
    if (vals.some((v) => v < 0 || v > 100)) errors.push("Prosentandeler må ligge mellom 0 og 100 – kontroller nevneren");
  }

  // 6. Forståelighet
  const sentences = q.reveal.explanation.split(/[.!?]+\s/).filter(Boolean);
  const avgWords = q.reveal.explanation.split(/\s+/).length / Math.max(1, sentences.length);
  if (avgWords > 32) warnings.push("Lange setninger i forklaringen – vurder å korte ned");
  if (q.prompt.length > 160) warnings.push("Spørsmålet er langt – vurder å korte ned");

  // 7. Tall i tekst må kunne spores til data
  const allowed = [...payloadNumbers(q), ...(ctx.allowedNumbers ?? []), ...numbersInText(q.referencePeriod), ...numbersInText(q.calculation ?? "")];
  const textNums = numbersInText([q.prompt, q.reveal.headline, q.reveal.explanation].join(" "));
  const unknown = textNums.filter((n) => !numberAllowed(n, allowed));
  if (unknown.length) {
    const msg = `Tall i teksten som ikke finnes i datagrunnlaget: ${[...new Set(unknown)].join(", ")}`;
    if (ctx.strictNumbers) errors.push(msg);
    else warnings.push(msg);
  }

  // 8. Duplikater
  let duplicateOf: string | undefined;
  const me = `${q.prompt} ${"statement" in p ? p.statement : ""}`;
  for (const e of ctx.existing ?? []) {
    if (e.id === q.id) continue;
    if (similarity(me, e.prompt) >= 0.72) {
      duplicateOf = e.id;
      errors.push(`Nesten likt et eksisterende spørsmål (${e.id})`);
      break;
    }
  }

  return { ok: errors.length === 0, errors, warnings, flags, computedRisk, duplicateOf };
}
