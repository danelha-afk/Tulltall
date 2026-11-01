import { notFound } from "next/navigation";
import { getDb } from "@/lib/db/client";
import { getQuestionRow, questionRevisions, TRANSITIONS } from "@/lib/db/questions";
import { changeStatus } from "../../../actions";
import { Card, RiskBadge, StatusBadge, statusLabel } from "../../ui";
import { QuestionEditor } from "./QuestionEditor";

export default async function EditQuestion({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ feil?: string }> }) {
  const { id } = await params;
  const { feil } = await searchParams;
  const db = await getDb();
  const row = await getQuestionRow(db, id);
  if (!row) notFound();
  const revisions = await questionRevisions(db, id);
  const used = await db.query<{ game_date: string }>(`SELECT game_date FROM games WHERE kind = 'daily' AND question_ids ? $1 ORDER BY game_date DESC LIMIT 10`, [id]);
  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-center gap-2">
        <StatusBadge status={row.status} />
        <RiskBadge risk={row.risk} />
        <span className="kicker">id: {row.id} · versjon {row.version} · {row.origin}</span>
      </div>
      {feil ? <p className="font-bold text-korall-dyp">{feil}</p> : null}
      <Card title="Endre status">
        <div className="flex flex-wrap gap-2">
          {TRANSITIONS[row.status].map((to) => (
            <form key={to} action={changeStatus} className="flex gap-2 items-center">
              <input type="hidden" name="id" value={row.id} />
              <input type="hidden" name="to" value={to} />
              <input type="hidden" name="back" value={`/admin/sporsmal/${row.id}`} />
              {to === "archived" ? <input name="note" placeholder="Årsak (vises i kildelisten)" className="h-10 rounded-full border-2 border-blekk px-3 bg-papir text-sm" /> : null}
              <button className={`btn ${to === "approved" ? "btn-acid" : to === "archived" ? "btn-hot" : "btn-ghost"} !min-h-10 !py-1.5 text-sm`}>
                {to === "archived" && row.status === "published" ? "Trekk tilbake" : `→ ${statusLabel(to)}`}
              </button>
            </form>
          ))}
        </div>
        {row.qa.errors?.length ? <ul className="mt-3 text-sm text-korall-dyp font-bold">{row.qa.errors.map((e) => <li key={e}>✗ {e}</li>)}</ul> : null}
        {row.qa.flags?.length ? <ul className="mt-2 text-sm">{row.qa.flags.map((e) => <li key={e}>⚑ {e}</li>)}</ul> : null}
        <p className="mt-3 text-sm text-blekk-2">Brukt i runder: {used.map((u) => u.game_date).join(", ") || "ingen"}</p>
      </Card>
      <QuestionEditor row={{ id: row.id, content: row.content }} />
      <Card title="Redaksjonell historikk">
        <ol className="grid gap-1 text-sm">
          {revisions.map((r) => (
            <li key={r.id} className="border-b border-blekk/10 py-1">
              {r.created_at.toISOString().slice(0, 16).replace("T", " ")} · v{r.version} · <strong>{r.action}</strong> {r.from_status ? `${statusLabel(r.from_status)} → ` : ""}{r.to_status ? statusLabel(r.to_status) : ""} · {r.actor}
              {r.note ? <span className="text-blekk-2"> – {r.note}</span> : null}
            </li>
          ))}
        </ol>
      </Card>
    </div>
  );
}
