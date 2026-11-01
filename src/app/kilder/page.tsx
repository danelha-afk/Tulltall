import type { Metadata } from "next";
import { getDb } from "@/lib/db/client";
import { localDate } from "@/lib/game/dates";
import type { QuestionContent } from "@/lib/game/schema";
import { t } from "@/lib/i18n";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Kilder og metode",
  description: "Alle kilder bak spørsmålene som er brukt i TULL ELLER TALL?",
};

/** Kildeoversikt for spørsmål som allerede har vært brukt (ingen spoilere for dagens runde). */
export default async function Sources() {
  const db = await getDb();
  const rows = await db.query<{ id: string; content: QuestionContent; last_used_on: string | null; updated_at: Date }>(
    `SELECT id, content, last_used_on, updated_at FROM questions
     WHERE status = 'published' AND last_used_on IS NOT NULL AND last_used_on < $1
     ORDER BY last_used_on DESC LIMIT 500`,
    [localDate()],
  );
  const retracted = await db.query<{ id: string; content: QuestionContent; archived_reason: string | null; updated_at: Date }>(
    `SELECT id, content, archived_reason, updated_at FROM questions WHERE status = 'archived' AND published_at IS NOT NULL ORDER BY updated_at DESC LIMIT 50`,
  );
  const byPublisher = new Map<string, { title: string; url: string; question: string; period: string; verified: string; method: string }[]>();
  for (const r of rows) {
    for (const s of r.content.sources) {
      const list = byPublisher.get(s.publisher) ?? [];
      list.push({
        title: s.title,
        url: s.url,
        question: r.content.prompt,
        period: r.content.referencePeriod,
        verified: r.content.lastVerified,
        method: r.content.verification.method,
      });
      byPublisher.set(s.publisher, list);
    }
  }
  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <p className="kicker">Åpenhet</p>
      <h1 className="font-black font-wide uppercase text-[clamp(2.2rem,9vw,3.8rem)] leading-[0.9] mt-2">Kilder og metode</h1>
      <p className="serif-soft text-lg mt-5">
        Her er kildene bak alle spørsmål som har vært brukt i tidligere runder. Dagens runde vises ikke, så ingen får fasiten på forhånd. Hvert
        spørsmål i spillet har i tillegg en egen «Hvor kommer tallet fra?»-boks.
      </p>
      {rows.length === 0 ? <p className="mt-10 font-bold">Kildelisten fylles opp etter hvert som rundene blir spilt.</p> : null}
      {[...byPublisher.entries()]
        .sort((a, b) => b[1].length - a[1].length)
        .map(([publisher, list]) => (
          <section key={publisher} className="mt-10">
            <h2 className="font-black font-wide uppercase text-xl border-b-[2.5px] border-blekk pb-2">
              {publisher} <span className="kicker text-blekk-3">({list.length})</span>
            </h2>
            <ul className="mt-3 grid gap-3">
              {list.map((s, i) => (
                <li key={`${s.url}-${i}`} className="text-sm">
                  <a href={s.url} target="_blank" rel="noopener noreferrer" className="font-bold text-kobolt underline underline-offset-2 break-words">
                    {s.title}
                  </a>
                  <p className="text-blekk-2">
                    {s.question} · {s.period} · {t("game.lastVerified").toLowerCase()} {s.verified} ·{" "}
                    {t(`game.verification.${s.method}` as "game.verification.derived")}
                  </p>
                </li>
              ))}
            </ul>
          </section>
        ))}
      {retracted.length ? (
        <section className="mt-14">
          <h2 className="font-black font-wide uppercase text-xl border-b-[2.5px] border-blekk pb-2">Trukket tilbake</h2>
          <ul className="mt-3 grid gap-2 text-sm">
            {retracted.map((r) => (
              <li key={r.id}>
                <strong>{r.content.prompt}</strong> – {r.archived_reason ?? "trukket av redaksjonen"} ({r.updated_at.toISOString().slice(0, 10)})
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
