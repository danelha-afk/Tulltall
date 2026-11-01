import { getDb } from "@/lib/db/client";
import { dailySeries, experimentResults, formatPerformance, funnel, questionPerformance, retention, revenueAndCosts, topicPerformance } from "@/lib/analytics/dashboard";
import { getSettings } from "@/lib/db/settings";
import { saveRevenueAction } from "../../actions";
import { Card, Stat } from "../ui";

export default async function Analytics({ searchParams }: { searchParams: Promise<{ dager?: string }> }) {
  const { dager } = await searchParams;
  const days = [7, 30, 90].includes(Number(dager)) ? Number(dager) : 30;
  const db = await getDb();
  const settings = await getSettings(db);
  const [f, series, ret, qperf, fperf, tperf, money] = await Promise.all([
    funnel(db, days),
    dailySeries(db, 14),
    retention(db),
    questionPerformance(db, days),
    formatPerformance(db, days),
    topicPerformance(db, days),
    revenueAndCosts(db),
  ]);
  const experiments = await Promise.all(settings.experiments.map(async (e) => ({ e, rows: await experimentResults(db, e.key, days) })));
  const maxV = Math.max(1, ...series.map((s) => s.started));
  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="font-black font-wide uppercase text-3xl">Analyse</h1>
        <nav className="flex gap-2">
          {[7, 30, 90].map((d) => (
            <a key={d} href={`?dager=${d}`} className={`rounded-full border-2 border-blekk px-3 py-1 text-sm font-bold ${d === days ? "bg-syre" : ""}`}>{d} dager</a>
          ))}
        </nav>
      </div>
      <p className="text-sm text-blekk-2 max-w-3xl">Alt er aggregert. Hendelser uten samtykke lagres uten ID; gjenbesøk måles bare blant spillere som har samtykket. Delinger måles som faktiske besøk fra delte lenker – ikke bare trykk på knappen.</p>
      <Card title={`Trakt – siste ${days} dager`}>
        <dl className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <Stat label="Sidevisninger" value={f.pageViews} />
          <Stat label="Runder startet" value={f.sessionsStarted} />
          <Stat label="Fullføringsgrad" value={f.completionRate !== null ? `${f.completionRate} %` : "–"} />
          <Stat label="Tid per runde" value={f.avgMinutes !== null ? `${f.avgMinutes} min` : "–"} />
          <Stat label="Trykk på del" value={f.shareClicks} hint={`${f.shareSuccess} fullførte delinger`} />
          <Stat label="Utfordringer laget" value={f.challengesCreated} />
          <Stat label="Åpnede utfordringer" value={f.challengeOpens} hint={`${f.challengeSessions} runder spilt via utfordring`} />
          <Stat label="Nye spillere fra deling" value={f.newPlayersFromShares} />
          <Stat label="Åpnede enkeltspørsmål" value={f.singleOpens} />
          <Stat label="Varsler slått på" value={f.pushOptins} />
          <Stat label="Lagt på hjemskjerm" value={f.installs} />
          <Stat label="Gjenbesøk dag 1 / uke 1" value={ret.d1 !== null ? `${ret.d1} % / ${ret.d7} %` : "–"} hint={`Kohort: ${ret.cohort} samtykkende spillere`} />
        </dl>
      </Card>
      <Card title="Runder per dag (14 dager)">
        <div className="flex items-end gap-1 h-32" role="img" aria-label="Søylediagram over startede runder per dag">
          {series.map((s) => (
            <div key={s.day} className="flex-1 flex flex-col items-center justify-end gap-1">
              <div className="w-full bg-kobolt border border-blekk" style={{ height: `${(s.started / maxV) * 100}%` }} title={`${s.day}: ${s.started} startet, ${s.finished} fullført`} />
              <span className="text-[0.55rem] font-mono">{s.day.slice(8)}</span>
            </div>
          ))}
        </div>
      </Card>
      <div className="grid gap-6 md:grid-cols-2">
        <Card title="Spillformater">
          <table className="w-full text-sm">
            <thead><tr className="kicker text-left"><th>Format</th><th className="text-right">Svar</th><th className="text-right">Snittpoeng</th><th className="text-right">Treff</th></tr></thead>
            <tbody>{fperf.map((r) => <tr key={r.format} className="border-t border-blekk/10"><td>{r.format}</td><td className="text-right">{r.answers}</td><td className="text-right">{r.avg_points}</td><td className="text-right">{r.hit_rate} %</td></tr>)}</tbody>
          </table>
        </Card>
        <Card title="Temaer">
          <table className="w-full text-sm">
            <thead><tr className="kicker text-left"><th>Tema</th><th className="text-right">Svar</th><th className="text-right">Snittpoeng</th></tr></thead>
            <tbody>{tperf.map((r) => <tr key={r.topic} className="border-t border-blekk/10"><td>{r.topic}</td><td className="text-right">{r.answers}</td><td className="text-right">{r.avg_points}</td></tr>)}</tbody>
          </table>
        </Card>
      </div>
      <Card title="Spørsmål – hva fungerer?">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="kicker text-left"><th>Spørsmål</th><th className="text-right">Svar</th><th className="text-right">Snitt</th><th className="text-right">Treff</th><th className="text-right">Avbrudd</th><th className="text-right">Delt</th></tr></thead>
            <tbody>
              {qperf.map((q) => (
                <tr key={q.id} className="border-t border-blekk/10">
                  <td className="py-1 pr-2"><a className="underline" href={`/admin/sporsmal/${q.id}`}>{q.prompt}</a></td>
                  <td className="text-right">{q.answers}</td><td className="text-right">{q.avgPoints}</td><td className="text-right">{q.hitRate} %</td><td className="text-right">{q.abandons}</td><td className="text-right">{q.shares}</td>
                </tr>
              ))}
              {qperf.length === 0 ? <tr><td colSpan={6}>Ingen data ennå.</td></tr> : null}
            </tbody>
          </table>
        </div>
      </Card>
      <Card title="A/B-tester">
        {experiments.map(({ e, rows }) => (
          <div key={e.key} className="mb-4">
            <p className="font-bold">{e.key} {e.active ? "(aktiv)" : "(av)"} – {e.description}</p>
            <table className="w-full text-sm mt-1">
              <thead><tr className="kicker text-left"><th>Variant</th><th className="text-right">Runder</th><th className="text-right">Fullført</th><th className="text-right">Delinger</th></tr></thead>
              <tbody>
                {rows.map((r) => <tr key={r.variant} className="border-t border-blekk/10"><td>{r.variant}</td><td className="text-right">{r.sessions}</td><td className="text-right">{r.sessions ? Math.round((r.finished / r.sessions) * 100) : 0} %</td><td className="text-right">{r.shares}</td></tr>)}
                {rows.length === 0 ? <tr><td colSpan={4}>Ingen data.</td></tr> : null}
              </tbody>
            </table>
          </div>
        ))}
        <p className="text-xs text-blekk-2">Små forskjeller med få spillere er ofte tilfeldige. Vent til hver variant har minst noen hundre runder før du konkluderer.</p>
      </Card>
      <Card title="Inntekter og kostnader">
        <table className="w-full text-sm">
          <thead><tr className="kicker text-left"><th>Måned</th><th className="text-right">Annonser (kr)</th><th className="text-right">Annet (kr)</th><th className="text-right">Drift (kr)</th><th className="text-right">KI ($)</th><th className="text-right">Sidevisninger</th><th className="text-right">RPM (kr)</th></tr></thead>
          <tbody>
            {money.map((m) => (
              <tr key={m.month} className="border-t border-blekk/10">
                <td>{m.month}</td><td className="text-right">{m.ad_revenue_nok.toFixed(0)}</td><td className="text-right">{m.other_revenue_nok.toFixed(0)}</td><td className="text-right">{m.hosting_cost_nok.toFixed(0)}</td>
                <td className="text-right">{m.ai_cost_usd.toFixed(2)}</td><td className="text-right">{m.page_views}</td>
                <td className="text-right">{m.page_views ? ((m.ad_revenue_nok / m.page_views) * 1000).toFixed(1) : "–"}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <form action={saveRevenueAction} className="mt-4 grid gap-2 sm:grid-cols-6 items-end text-sm">
          <label className="grid gap-1"><span className="kicker">Måned</span><input name="month" placeholder="2026-11" className="h-10 rounded-xl border-2 border-blekk px-2 bg-papir" required /></label>
          <label className="grid gap-1"><span className="kicker">Annonser</span><input name="ad" inputMode="decimal" className="h-10 rounded-xl border-2 border-blekk px-2 bg-papir" /></label>
          <label className="grid gap-1"><span className="kicker">Annet</span><input name="other" inputMode="decimal" className="h-10 rounded-xl border-2 border-blekk px-2 bg-papir" /></label>
          <label className="grid gap-1"><span className="kicker">Drift</span><input name="hosting" inputMode="decimal" className="h-10 rounded-xl border-2 border-blekk px-2 bg-papir" /></label>
          <label className="grid gap-1"><span className="kicker">Notat</span><input name="note" className="h-10 rounded-xl border-2 border-blekk px-2 bg-papir" /></label>
          <button className="btn btn-ghost !min-h-10 !py-1">Lagre måned</button>
        </form>
        <p className="mt-2 text-xs text-blekk-2">Annonseinntekter registreres manuelt fra AdSense-rapporten (eller via AdSense Management API senere). RPM = inntekt per 1000 sidevisninger.</p>
      </Card>
    </div>
  );
}
