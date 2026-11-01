import { getDb } from "@/lib/db/client";
import { CATALOG } from "@/lib/data/catalog";
import { Card } from "../ui";

export default async function DataPage() {
  const db = await getDb();
  const [datasets, runs, findings, revisions, ai] = await Promise.all([
    db.query<{ id: string; table_id: string; title: string; status: string; source_updated_at: Date | null; last_checked_at: Date | null; last_fetched_at: Date | null; versions: number }>(
      `SELECT d.*, (SELECT count(*)::int FROM dataset_versions v WHERE v.dataset_id = d.id) AS versions FROM datasets d ORDER BY d.status, d.table_id LIMIT 200`,
    ),
    db.query<{ id: number; kind: string; status: string; started_at: Date; finished_at: Date | null; report: string | null; errors: string[] }>(
      `SELECT id, kind, status, started_at, finished_at, report, errors FROM pipeline_runs ORDER BY id DESC LIMIT 12`,
    ),
    db.query<{ id: string; kind: string; status: string; created_at: Date; payload: { measure: { label: string }; period: string; items: { label: string; value: number }[] } }>(
      `SELECT id, kind, status, created_at, payload FROM findings ORDER BY created_at DESC LIMIT 20`,
    ),
    db.query<{ dataset_id: string; n: number }>(`SELECT dataset_id, count(*)::int AS n FROM observation_revisions GROUP BY dataset_id`),
    db.query<{ month: string; model: string; calls: number; cost: number; failed: number }>(
      `SELECT to_char(created_at, 'YYYY-MM') AS month, model, count(*)::int AS calls, sum(cost_usd)::float AS cost, count(*) FILTER (WHERE NOT ok)::int AS failed
       FROM ai_usage GROUP BY 1, 2 ORDER BY 1 DESC LIMIT 24`,
    ),
  ]);
  const fmt = (d: Date | null) => (d ? d.toISOString().slice(0, 16).replace("T", " ") : "–");
  return (
    <div className="grid gap-6">
      <h1 className="font-black font-wide uppercase text-3xl">Data og automatisering</h1>
      <Card title="Overvåkede SSB-tabeller (katalog)">
        <ul className="grid gap-1 text-sm">
          {CATALOG.map((c) => {
            const d = datasets.find((x) => x.id === `ssb:${c.tableId}:${c.key}`);
            return (
              <li key={c.key} className="flex flex-wrap justify-between gap-2 border-b border-blekk/10 py-1">
                <span>
                  <strong>{c.tableId}</strong> {c.title} {c.verified ? "" : <span className="kicker text-korall-dyp">(ikke prøvekjørt mot API)</span>}
                </span>
                <span>
                  {d ? `${d.status} · oppdatert hos SSB ${fmt(d.source_updated_at)} · hentet ${fmt(d.last_fetched_at)} · ${d.versions} versjoner · ${revisions.find((r) => r.dataset_id === d.id)?.n ?? 0} revisjoner` : "ikke hentet ennå"}
                </span>
              </li>
            );
          })}
        </ul>
        <p className="mt-3 text-sm text-blekk-2">Nye tabeller legges til i <code>src/lib/data/catalog.ts</code>. Kandidater nedenfor er oppdaget automatisk og venter på vurdering.</p>
      </Card>
      <Card title="Kandidattabeller oppdaget hos SSB">
        <ul className="grid gap-1 text-sm">
          {datasets.filter((d) => d.status === "candidate").map((d) => (
            <li key={d.id}>
              <a className="underline text-kobolt" href={`https://www.ssb.no/statbank/table/${d.table_id}`} target="_blank" rel="noopener noreferrer">{d.table_id}</a> {d.title} · oppdatert {fmt(d.source_updated_at)}
            </li>
          ))}
          {datasets.every((d) => d.status !== "candidate") ? <li>Ingen ennå – fylles av den ukentlige jobben.</li> : null}
        </ul>
      </Card>
      <Card title="Siste kjøringer">
        <div className="grid gap-3">
          {runs.map((r) => (
            <details key={r.id} className="rounded-xl border-2 border-blekk/30 p-3">
              <summary className="cursor-pointer font-bold">
                #{r.id} {r.kind} · {r.status} · {fmt(r.started_at)} {r.errors.length ? <span className="text-korall-dyp">· {r.errors.length} feil</span> : null}
              </summary>
              {r.errors.length ? <ul className="mt-2 text-sm text-korall-dyp">{r.errors.map((e) => <li key={e}>⚠ {e}</li>)}</ul> : null}
              {r.report ? <pre className="mt-2 whitespace-pre-wrap text-xs font-mono">{r.report}</pre> : null}
            </details>
          ))}
          {runs.length === 0 ? <p className="text-sm">Ingen kjøringer ennå.</p> : null}
        </div>
      </Card>
      <Card title="Nye statistikkfunn">
        <ul className="grid gap-1 text-sm">
          {findings.map((f) => (
            <li key={f.id} className="border-b border-blekk/10 py-1">
              <span className="kicker">{f.kind} · {f.status}</span> {f.payload.measure.label} ({f.payload.period}): {f.payload.items.slice(0, 3).map((i) => `${i.label} ${i.value}`).join(", ")}
            </li>
          ))}
          {findings.length === 0 ? <li>Ingen funn ennå.</li> : null}
        </ul>
      </Card>
      <Card title="Claude API-forbruk">
        <table className="w-full text-sm">
          <thead><tr className="kicker text-left"><th>Måned</th><th>Modell</th><th className="text-right">Kall</th><th className="text-right">Feil</th><th className="text-right">Kostnad</th></tr></thead>
          <tbody>
            {ai.map((a) => (
              <tr key={`${a.month}-${a.model}`} className="border-t border-blekk/10"><td>{a.month}</td><td>{a.model}</td><td className="text-right">{a.calls}</td><td className="text-right">{a.failed}</td><td className="text-right">${a.cost.toFixed(3)}</td></tr>
            ))}
            {ai.length === 0 ? <tr><td colSpan={5}>Ingen KI-kall ennå.</td></tr> : null}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
