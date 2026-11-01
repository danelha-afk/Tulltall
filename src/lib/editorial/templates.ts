/**
 * Deterministiske maler: gjør et statistisk funn om til et komplett, gyldig spørsmålsutkast.
 * Alle tall kommer fra funnet. KI-redaksjonen kan senere forbedre språket, men ikke tallene.
 */
import type { Finding } from "../data/analysis";
import type { QuestionContentInput } from "../game/schema";
import { formatNumber, formatValue } from "../i18n";

export interface Draft {
  question: QuestionContentInput;
  findingId: string;
  template: string;
}

function slug(s: string): string {
  return s
    .toLowerCase()
    .replace(/æ/g, "ae")
    .replace(/ø/g, "o")
    .replace(/å/g, "a")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);
}

function baseFields(f: Finding, today: string) {
  return {
    locale: "nb" as const,
    tags: ["pipeline", f.catalogKey, f.kind],
    sources: [
      {
        publisher: "SSB",
        title: f.provenance.sourceTitle,
        url: f.provenance.sourceUrl,
        tableId: f.tableId,
        accessed: today,
        note: `Uttrekk: ${f.provenance.queryUrl.slice(0, 300)}`,
      },
    ],
    lastVerified: today,
    verification: { method: "pipeline" as const, note: `Beregnet automatisk fra SSB-tabell ${f.tableId}${f.provenance.sourceUpdated ? `, oppdatert ${f.provenance.sourceUpdated.slice(0, 10)}` : ""}.` },
    seasonMonths: [],
  };
}

function periodText(p: string): string {
  if (/^\d{4}$/.test(p)) return `i ${p}`;
  if (/^\d{4}M\d{2}$/.test(p)) {
    const months = ["januar", "februar", "mars", "april", "mai", "juni", "juli", "august", "september", "oktober", "november", "desember"];
    return `i ${months[Number(p.slice(5)) - 1]} ${p.slice(0, 4)}`;
  }
  return `(${p})`;
}

export function draftsFromFinding(f: Finding, today: string): Draft[] {
  const out: Draft[] = [];
  const unit = f.measure.unit;
  const fmt = (v: number) => formatValue(v, unit);
  const ml = f.measure.label.toLowerCase();
  const isPopulation = f.catalogKey.startsWith("befolkning");
  const category = isPopulation ? "fun" : "current";
  const topic = isPopulation ? "befolkning" : "økonomi";
  const risk = f.kind === "trend" || f.kind === "change" ? ("medium" as const) : ("low" as const);
  const base = baseFields(f, today);
  const shortId = f.id.slice(2, 10);

  if (f.kind === "rivalry" && f.items.length === 2) {
    const [a, b] = f.items;
    const winner = a.value > b.value ? a : b;
    const loser = winner === a ? b : a;
    out.push({
      findingId: f.id,
      template: "rivalry-compare",
      question: {
        ...base,
        id: `p-${slug(`${a.label}-${b.label}-${f.measure.key}`)}-${shortId}`,
        category,
        topic,
        difficulty: 3,
        risk,
        tone: "playful",
        kicker: `${a.label} mot ${b.label}`.slice(0, 40),
        prompt: `${a.label} eller ${b.label}: Hvem har høyest ${ml} ${periodText(f.period)}?`.slice(0, 200),
        payload: {
          format: "compare",
          indicator: `${f.measure.label} ${periodText(f.period)}`,
          unit,
          pick: "highest",
          items: [
            { id: a.code, label: a.label, value: a.value },
            { id: b.code, label: b.label, value: b.value },
          ],
        },
        reveal: {
          headline: `${winner.label} vinner denne runden.`,
          explanation: `${winner.label}: ${fmt(winner.value)}. ${loser.label}: ${fmt(loser.value)}.`,
          caveats: [],
        },
        referencePeriod: f.period,
        dataQuality: 4,
        shareText: `${a.label} eller ${b.label}? Gjett hvem som har høyest ${ml}.`.slice(0, 160),
      },
    });
  }

  const gapOk = (vals: number[]) => {
    const s = [...vals].sort((x, y) => y - x);
    return s.length < 2 || Math.abs(s[0] - s[1]) / Math.max(Math.abs(s[0]), 1e-9) >= 0.02;
  };
  if (f.kind === "extremes" && f.items.length >= 3 && gapOk(f.items.slice(0, 3).map((i) => i.value))) {
    const top = f.items[0];
    const others = f.items.slice(1, 3);
    out.push({
      findingId: f.id,
      template: "extremes-compare",
      question: {
        ...base,
        id: `p-${slug(`topp-${f.measure.key}-${f.period}`)}-${shortId}`,
        category,
        topic,
        difficulty: 4,
        risk,
        tone: "playful",
        kicker: "Kommunerekord",
        prompt: `${top.label}, ${others.map((o) => o.label).join(" eller ")}: Hvilken kommune har høyest ${ml} ${periodText(f.period)}?`.slice(0, 200),
        payload: {
          format: "compare",
          indicator: `${f.measure.label} ${periodText(f.period)}`,
          unit,
          pick: "highest",
          items: [top, ...others].map((i) => ({ id: i.code, label: i.label, value: i.value })),
        },
        reveal: {
          headline: `${top.label} topper hele landet.`,
          explanation: `${top.label} har ${fmt(top.value)}, høyest av alle ${formatNumber(f.computed.count ?? 0)} kommuner med nok innbyggere til å gi et robust tall. Snittet er ${fmt(f.computed.mean)}.`,
          caveats: f.guards.excludedSmall ? [`${f.guards.excludedSmall} små kommuner er holdt utenfor fordi små tall svinger mye.`] : [],
        },
        referencePeriod: f.period,
        dataQuality: 4,
        shareText: `Hvilken kommune har høyest ${ml}? Det er ikke den du tror.`.slice(0, 160),
      },
    });
  }

  if (f.kind === "rank" && f.items.length >= 4) {
    const sorted = [...f.items].sort((x, y) => y.value - x.value);
    out.push({
      findingId: f.id,
      template: "rank-cities",
      question: {
        ...base,
        id: `p-${slug(`rang-${f.measure.key}-${f.period}`)}-${shortId}`,
        category,
        topic,
        difficulty: 4,
        risk,
        tone: "playful",
        kicker: "Byduell",
        prompt: `Ranger kommunene etter ${ml} ${periodText(f.period)} – høyest øverst.`.slice(0, 200),
        payload: {
          format: "rank",
          indicator: `${f.measure.label} ${periodText(f.period)}`,
          unit,
          order: "desc",
          items: f.items.map((i) => ({ id: i.code, label: i.label, value: i.value })),
        },
        reveal: {
          headline: `${sorted[0].label} øverst, ${sorted[sorted.length - 1].label} nederst.`,
          explanation: sorted.map((s) => `${s.label}: ${fmt(s.value)}`).join(". ") + ".",
          caveats: [],
        },
        referencePeriod: f.period,
        dataQuality: 4,
        shareText: `Klarer du rekkefølgen på ${ml}?`.slice(0, 160),
      },
    });
  }

  if (f.kind === "trend" && f.series && f.series.length >= 4) {
    const s = f.series;
    const vals = s.map((x) => x.value);
    const lo = Math.min(...vals);
    const hi = Math.max(...vals);
    const span = Math.max(hi - lo, Math.abs(hi) * 0.2, 1);
    const step = unit.decimals > 0 ? 10 ** -unit.decimals : 1;
    const min = Math.floor((lo - span * 0.6) / step) * step;
    const max = Math.ceil((hi + span * 0.6) / step) * step;
    out.push({
      findingId: f.id,
      template: "trend-guess",
      question: {
        ...base,
        id: `p-${slug(`trend-${f.measure.key}-${f.period}`)}-${shortId}`,
        category: "current",
        topic,
        difficulty: 3,
        risk: "medium",
        tone: "neutral",
        kicker: "Tidsmaskinen",
        prompt: `Hvor endte ${ml} ${periodText(f.period)}?`.slice(0, 200),
        payload: {
          format: "trend",
          indicator: f.measure.label,
          unit,
          series: s,
          known: Math.max(1, s.length - 2),
          min: unit.suffix === "%" ? Math.max(min, -100) : min,
          max,
          step,
          tolerance: Math.max(span * 0.15, step),
        },
        reveal: {
          headline: `${fmt(f.computed.last)} ${periodText(f.period)}.`,
          explanation: `Fra ${fmt(f.computed.first)} ${periodText(f.fromPeriod ?? s[0].period)} til ${fmt(f.computed.last)} ${periodText(f.period)}.`,
          caveats: [],
        },
        referencePeriod: `${s[0].period}–${s[s.length - 1].period}`,
        dataQuality: 4,
        shareText: `Spå hvor kurven for ${ml} endte!`.slice(0, 160),
      },
    });
  }

  return out;
}
