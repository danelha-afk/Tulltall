import Link from "next/link";
import { getDb } from "@/lib/db/client";
import { upcomingGames } from "@/lib/db/games";
import { getSettings } from "@/lib/db/settings";
import { funnel } from "@/lib/analytics/dashboard";
import { localDate } from "@/lib/game/dates";
import { Card, Stat, StatusBadge } from "./ui";

export default async function AdminHome() {
  const db = await getDb();
  const today = localDate();
  const [counts, games, runs, settings, f7, ai] = await Promise.all([
    db.query<{ status: string; n: number }>(`SELECT status, count(*)::int AS n FROM questions GROUP BY status`),
    upcomingGames(db, today, 8),
    db.query<{ id: number; kind: string; status: string; started_at: Date; errors: string[] }>(`SELECT id, kind, status, started_at, errors FROM pipeline_runs ORDER BY id DESC LIMIT 6`),
    getSettings(db),
    funnel(db, 7),
    db.one<{ s: number }>(`SELECT COALESCE(sum(cost_usd),0)::float AS s FROM ai_usage WHERE created_at >= date_trunc('month', now())`),
  ]);
  const c = (s: string) => counts.find((x) => x.status === s)?.n ?? 0;
  const active = c("approved") + c("published");
  return (
    <div className="grid gap-6">
      <div className="grid gap-6 md:grid-cols-3">
        <Card title="Spørsmålsbanken" tone="syre">
          <dl className="grid grid-cols-2 gap-3">
            <Stat label="Aktive" value={active} hint="Godkjent + publisert. Mål før lansering: 120" />
            <Stat label="Til godkjenning" value={<Link href="/admin/ko" className="underline">{c("review_required") + c("validated")}</Link>} />
            <Stat label="Utkast med feil" value={c("draft")} />
            <Stat label="Trukket/arkivert" value={c("archived")} />
          </dl>
        </Card>
        <Card title="Siste 7 dager">
          <dl className="grid grid-cols-2 gap-3">
            <Stat label="Runder startet" value={f7.sessionsStarted} />
            <Stat label="Fullført" value={f7.completionRate !== null ? `${f7.completionRate} %` : "–"} />
            <Stat label="Delinger" value={f7.shareSuccess} />
            <Stat label="Nye fra deling" value={f7.newPlayersFromShares} />
          </dl>
          <Link href="/admin/analyse" className="kicker underline mt-3 inline-block">Hele analysen →</Link>
        </Card>
        <Card title="Claude API denne måneden">
          <dl className="grid gap-3">
            <Stat label="Forbruk" value={`$${(ai?.s ?? 0).toFixed(2)}`} hint={`Budsjett $${settings.aiMonthlyBudgetUsd} / mnd, $${settings.aiRunBudgetUsd} per kjøring`} />
          </dl>
        </Card>
      </div>
      <Card title="Kommende runder">
        <ul className="grid gap-1 text-sm">
          {games.map((g) => (
            <li key={g.id} className="flex flex-wrap justify-between gap-2 border-b border-blekk/10 py-1">
              <span className="font-bold">{g.game_date}</span>
              <span>{(g.question_ids as string[]).length} spørsmål · {g.locked_at ? "låst" : "kan endres"} · {g.players} spillere</span>
            </li>
          ))}
          {games.length === 0 ? <li>Ingen planlagte runder. <Link className="underline" href="/admin/runder">Planlegg →</Link></li> : null}
        </ul>
      </Card>
      <Card title="Automatisering – siste kjøringer">
        <ul className="grid gap-1 text-sm">
          {runs.map((r) => (
            <li key={r.id} className="flex flex-wrap justify-between gap-2 border-b border-blekk/10 py-1">
              <span>
                #{r.id} {r.kind} · {r.started_at.toISOString().slice(0, 16).replace("T", " ")}
              </span>
              <span className="flex items-center gap-2">
                <StatusBadge status={r.status === "ok" ? "approved" : r.status === "failed" ? "review_required" : "validated"} />
                {r.errors.length ? <span className="text-korall-dyp font-bold">{r.errors.length} feil</span> : null}
              </span>
            </li>
          ))}
          {runs.length === 0 ? <li>Ingen kjøringer ennå.</li> : null}
        </ul>
        <Link href="/admin/data" className="kicker underline mt-3 inline-block">Detaljer →</Link>
      </Card>
    </div>
  );
}
