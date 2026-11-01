import Link from "next/link";
import { getDb } from "@/lib/db/client";
import { listQuestions } from "@/lib/db/questions";
import { formatValue } from "@/lib/i18n";
import type { Payload } from "@/lib/game/schema";
import { changeStatus } from "../../actions";
import { Card, RiskBadge, StatusBadge } from "../ui";

function answerSummary(p: Payload): string {
  switch (p.format) {
    case "truefalse":
      return p.answer ? "Fasit: TALL (stemmer)" : `Fasit: TULL – ${p.correction ?? ""}`;
    case "estimate":
      return `Fasit: ${formatValue(p.answer, p.unit)}`;
    case "compare":
    case "rank":
      return p.items.map((i) => `${i.label}: ${formatValue(i.value, p.unit)}`).join(" · ");
    case "trend":
      return p.series.map((s) => `${s.period}: ${formatValue(s.value, p.unit)}`).join(" · ");
    case "map":
      return `Riktig: ${p.options.find((o) => o.correct)?.label}`;
  }
}

export default async function Queue() {
  const rows = await listQuestions(await getDb(), { status: ["review_required", "validated", "draft"], limit: 200 });
  rows.sort((a, b) => (b.scores.priority ?? 0) - (a.scores.priority ?? 0));
  return (
    <div>
      <h1 className="font-black font-wide uppercase text-3xl">Godkjenningskø</h1>
      <p className="mt-2 max-w-2xl text-blekk-2">
        Kontroller tallene mot kilden før du godkjenner. Høyrisiko-spørsmål (kriminalitet, migrasjon, helse m.m.) krever alltid din godkjenning.
        Spørsmål med feil i faktakontrollen kan ikke godkjennes før de er rettet.
      </p>
      <div className="mt-6 grid gap-4">
        {rows.map((r) => (
          <Card key={r.id}>
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge status={r.status} />
              <RiskBadge risk={r.risk} />
              <span className="kicker">{r.category} · {r.format} · {r.origin}</span>
              {typeof r.scores.priority === "number" ? <span className="kicker ml-auto">Prioritet {Math.round(r.scores.priority * 100)}</span> : null}
            </div>
            <h2 className="mt-3 font-black text-xl leading-tight">{r.content.prompt}</h2>
            {r.content.payload.format === "truefalse" ? <p className="serif-soft italic mt-1">«{r.content.payload.statement}»</p> : null}
            <p className="mt-2 font-mono text-sm">{answerSummary(r.content.payload)}</p>
            <p className="mt-2"><strong>{r.content.reveal.headline}</strong> {r.content.reveal.explanation}</p>
            <ul className="mt-2 text-sm">
              {r.content.sources.map((s) => (
                <li key={s.url}>
                  Kilde: <a className="underline text-kobolt" href={s.url} target="_blank" rel="noopener noreferrer">{s.publisher} – {s.title}</a> ({r.content.referencePeriod}){s.tableId ? ` · tabell ${s.tableId}` : ""}
                </li>
              ))}
            </ul>
            {r.qa.errors?.length ? <ul className="mt-2 text-sm text-korall-dyp font-bold">{r.qa.errors.map((e) => <li key={e}>✗ {e}</li>)}</ul> : null}
            {r.qa.flags?.length ? <ul className="mt-2 text-sm">{r.qa.flags.map((e) => <li key={e}>⚑ {e}</li>)}</ul> : null}
            {r.qa.warnings?.length ? <ul className="mt-1 text-xs text-blekk-2">{r.qa.warnings.map((e) => <li key={e}>· {e}</li>)}</ul> : null}
            <div className="mt-4 flex flex-wrap gap-2">
              <form action={changeStatus}>
                <input type="hidden" name="id" value={r.id} />
                <input type="hidden" name="to" value="approved" />
                <input type="hidden" name="back" value="/admin/ko" />
                <input type="hidden" name="note" value="Godkjent i køen" />
                <button className="btn btn-acid !min-h-10 !py-1.5 text-sm" disabled={r.qa.ok === false || r.status === "draft"}>Godkjenn</button>
              </form>
              <Link href={`/admin/sporsmal/${r.id}`} className="btn btn-ghost !min-h-10 !py-1.5 text-sm">Rediger</Link>
              <form action={changeStatus}>
                <input type="hidden" name="id" value={r.id} />
                <input type="hidden" name="to" value="archived" />
                <input type="hidden" name="back" value="/admin/ko" />
                <input type="hidden" name="note" value="Avvist i køen" />
                <button className="btn btn-ghost !min-h-10 !py-1.5 text-sm">Avvis</button>
              </form>
            </div>
          </Card>
        ))}
        {rows.length === 0 ? <p className="font-bold">Køen er tom. 🎉</p> : null}
      </div>
    </div>
  );
}
