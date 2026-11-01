"use client";
import { useActionState } from "react";
import { saveQuestionForm, type ActionState } from "../../../actions";
import type { QuestionContent } from "@/lib/game/schema";

const field = "h-11 rounded-xl border-2 border-blekk px-3 bg-papir w-full";
const area = "rounded-xl border-2 border-blekk p-3 bg-papir w-full";

export function QuestionEditor({ row }: { row: { id: string; content: QuestionContent } }) {
  const c = row.content;
  const [state, action, pending] = useActionState<ActionState, FormData>(saveQuestionForm, null);
  return (
    <form action={action} className="grid gap-4 rounded-2xl border-[2.5px] border-blekk bg-papir p-4 shadow-[4px_4px_0_var(--color-blekk)]">
      <input type="hidden" name="id" value={row.id} />
      <h2 className="kicker">Rediger innhold</h2>
      <label className="grid gap-1"><span className="font-bold">Spørsmål</span><input name="prompt" defaultValue={c.prompt} className={field} maxLength={200} required /></label>
      <div className="grid gap-4 md:grid-cols-3">
        <label className="grid gap-1"><span className="font-bold">Stikkord (kicker)</span><input name="kicker" defaultValue={c.kicker} className={field} maxLength={40} /></label>
        <label className="grid gap-1"><span className="font-bold">Emne</span><input name="topic" defaultValue={c.topic} className={field} required /></label>
        <label className="grid gap-1"><span className="font-bold">Referanseperiode</span><input name="referencePeriod" defaultValue={c.referencePeriod} className={field} required /></label>
      </div>
      <div className="grid gap-4 md:grid-cols-4">
        <label className="grid gap-1"><span className="font-bold">Kategori</span>
          <select name="category" defaultValue={c.category} className={field}>
            <option value="fun">Moro</option><option value="misconception">Sjekk magefølelsen</option><option value="current">Aktuelt</option>
          </select>
        </label>
        <label className="grid gap-1"><span className="font-bold">Risiko</span>
          <select name="risk" defaultValue={c.risk} className={field}><option value="low">Lav</option><option value="medium">Middels</option><option value="high">Høy</option></select>
        </label>
        <label className="grid gap-1"><span className="font-bold">Tone</span>
          <select name="tone" defaultValue={c.tone} className={field}><option value="playful">Leken</option><option value="neutral">Nøytral</option><option value="serious">Alvorlig</option></select>
        </label>
        <label className="grid gap-1"><span className="font-bold">Vanskelighetsgrad (1–5)</span><input name="difficulty" type="number" min={1} max={5} defaultValue={c.difficulty} className={field} /></label>
      </div>
      <label className="grid gap-1"><span className="font-bold">Punchline etter svaret</span><input name="headline" defaultValue={c.reveal.headline} className={field} maxLength={140} required /></label>
      <label className="grid gap-1"><span className="font-bold">Forklaring (1–3 setninger)</span><textarea name="explanation" defaultValue={c.reveal.explanation} rows={3} className={area} maxLength={600} required /></label>
      <label className="grid gap-1"><span className="font-bold">«Hva sier tallene egentlig?» (påkrevd ved høy risiko)</span><textarea name="deepDive" defaultValue={c.reveal.deepDive} rows={4} className={area} maxLength={1600} /></label>
      <label className="grid gap-1"><span className="font-bold">Forbehold (ett per linje)</span><textarea name="caveats" defaultValue={c.reveal.caveats.join("\n")} rows={2} className={area} /></label>
      <label className="grid gap-1"><span className="font-bold">Delingstekst (uten fasit)</span><input name="shareText" defaultValue={c.shareText} className={field} maxLength={160} /></label>
      <label className="grid gap-1"><span className="font-bold">Beregning (hvis svaret er utledet)</span><input name="calculation" defaultValue={c.calculation} className={field} maxLength={800} /></label>
      <div className="grid gap-4 md:grid-cols-3">
        <label className="grid gap-1"><span className="font-bold">Sist kontrollert</span><input name="lastVerified" type="date" defaultValue={c.lastVerified} className={field} required /></label>
        <label className="grid gap-1"><span className="font-bold">Kontrollmetode</span>
          <select name="verificationMethod" defaultValue={c.verification.method} className={field}>
            <option value="primary-table">Mot primærtabell</option><option value="primary-publication">Mot kildens publikasjon</option>
            <option value="secondary-snippet">Mot gjengivelse av kilden</option><option value="derived">Beregnet fra primærdata</option><option value="pipeline">Automatisk fra datamotoren</option>
          </select>
        </label>
        <label className="grid gap-1"><span className="font-bold">Kontrollnotat</span><input name="verificationNote" defaultValue={c.verification.note} className={field} /></label>
      </div>
      <details className="rounded-xl border-2 border-dashed border-blekk p-3">
        <summary className="cursor-pointer font-bold">Avansert: svardata og kilder (JSON)</summary>
        <p className="text-sm text-blekk-2 mt-2">Her ligger fasit og alternativer. Endringer kontrolleres automatisk før lagring.</p>
        <label className="grid gap-1 mt-2"><span className="kicker">Svardata</span><textarea name="payload" defaultValue={JSON.stringify(c.payload, null, 2)} rows={12} className={`${area} font-mono text-xs`} /></label>
        <label className="grid gap-1 mt-2"><span className="kicker">Kilder</span><textarea name="sources" defaultValue={JSON.stringify(c.sources, null, 2)} rows={8} className={`${area} font-mono text-xs`} /></label>
      </details>
      <label className="grid gap-1"><span className="font-bold">Notat til historikken</span><input name="note" className={field} placeholder="Hva endret du, og hvorfor?" /></label>
      <button className="btn btn-primary w-fit" disabled={pending}>Lagre og kontroller</button>
      {state ? (
        <div className={`rounded-xl border-2 border-blekk p-3 ${state.ok ? "bg-syre" : "bg-rosa"}`}>
          <p className="font-bold">{state.message}</p>
          {state.errors?.length ? <ul className="mt-1 text-sm">{state.errors.map((e) => <li key={e}>{e}</li>)}</ul> : null}
        </div>
      ) : null}
    </form>
  );
}
