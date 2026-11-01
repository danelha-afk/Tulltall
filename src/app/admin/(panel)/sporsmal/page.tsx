import Link from "next/link";
import { getDb } from "@/lib/db/client";
import { listQuestions } from "@/lib/db/questions";
import { STATUSES, type QuestionStatus } from "@/lib/game/schema";
import { RiskBadge, StatusBadge, statusLabel } from "../ui";

export default async function Bank({ searchParams }: { searchParams: Promise<{ status?: string; q?: string; kategori?: string }> }) {
  const sp = await searchParams;
  const status = STATUSES.includes(sp.status as QuestionStatus) ? (sp.status as QuestionStatus) : undefined;
  const rows = await listQuestions(await getDb(), { status, search: sp.q?.slice(0, 80), category: sp.kategori && ["fun", "misconception", "current"].includes(sp.kategori) ? sp.kategori : undefined });
  return (
    <div>
      <h1 className="font-black font-wide uppercase text-3xl">Spørsmålsbank</h1>
      <form className="mt-4 flex flex-wrap gap-2 items-end">
        <label className="grid gap-1">
          <span className="kicker">Søk</span>
          <input name="q" defaultValue={sp.q} className="h-10 rounded-full border-2 border-blekk px-3 bg-papir" />
        </label>
        <label className="grid gap-1">
          <span className="kicker">Status</span>
          <select name="status" defaultValue={status ?? ""} className="h-10 rounded-full border-2 border-blekk px-3 bg-papir">
            <option value="">Alle</option>
            {STATUSES.map((s) => <option key={s} value={s}>{statusLabel(s)}</option>)}
          </select>
        </label>
        <label className="grid gap-1">
          <span className="kicker">Kategori</span>
          <select name="kategori" defaultValue={sp.kategori ?? ""} className="h-10 rounded-full border-2 border-blekk px-3 bg-papir">
            <option value="">Alle</option>
            <option value="fun">Moro</option>
            <option value="misconception">Sjekk magefølelsen</option>
            <option value="current">Aktuelt</option>
          </select>
        </label>
        <button className="btn btn-ghost !min-h-10 !py-1.5">Filtrer</button>
      </form>
      <p className="mt-4 text-sm text-blekk-2">{rows.length} spørsmål</p>
      <ul className="mt-2 grid gap-2">
        {rows.map((r) => (
          <li key={r.id} className="rounded-xl border-2 border-blekk bg-papir p-3 flex flex-wrap items-center gap-2">
            <StatusBadge status={r.status} />
            <RiskBadge risk={r.risk} />
            <Link href={`/admin/sporsmal/${r.id}`} className="font-bold hover:underline flex-1 min-w-[12rem]">
              {r.content.prompt}
              {r.content.payload.format === "truefalse" ? <span className="block font-normal text-sm text-blekk-2">«{r.content.payload.statement}»</span> : null}
            </Link>
            <span className="kicker text-blekk-3">{r.format} · brukt {r.exposure_count}× {r.last_used_on ? `(sist ${r.last_used_on})` : ""}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
