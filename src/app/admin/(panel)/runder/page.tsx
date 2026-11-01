import { getDb } from "@/lib/db/client";
import { upcomingGames } from "@/lib/db/games";
import { getQuestionRows } from "@/lib/db/questions";
import { addDays, localDate } from "@/lib/game/dates";
import { regenerateAction, scheduleAction } from "../../actions";
import { Card } from "../ui";

export default async function Rounds({ searchParams }: { searchParams: Promise<{ feil?: string }> }) {
  const { feil } = await searchParams;
  const db = await getDb();
  const today = localDate();
  const games = await upcomingGames(db, addDays(today, -3), 18);
  const all = await getQuestionRows(db, [...new Set(games.flatMap((g) => g.question_ids as string[]))]);
  const byId = new Map(all.map((q) => [q.id, q]));
  return (
    <div>
      <h1 className="font-black font-wide uppercase text-3xl">Daglige runder</h1>
      <p className="mt-2 max-w-2xl text-blekk-2">
        Rundene settes sammen automatisk etter innholdsmiksen og rotasjonsreglene. En runde låses når dagen starter, slik at alle (og alle som får en
        utfordringslenke) får de samme spørsmålene. Fremtidige runder kan lages på nytt.
      </p>
      <form action={scheduleAction} className="mt-4">
        <button className="btn btn-primary">Planlegg de neste 14 dagene</button>
      </form>
      {feil ? <p className="mt-3 font-bold text-korall-dyp">{feil}</p> : null}
      <div className="mt-6 grid gap-4">
        {games.map((g) => (
          <Card key={g.id} tone={g.game_date === today ? "syre" : "papir"}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="font-black text-lg">
                {g.game_date} {g.game_date === today ? "(i dag)" : ""}
              </h2>
              <span className="kicker">{g.locked_at ? "Låst" : "Ikke publisert"} · {g.players} spillere</span>
            </div>
            <ol className="mt-2 grid gap-1 text-sm list-decimal pl-5">
              {(g.question_ids as string[]).map((id) => {
                const q = byId.get(id);
                return (
                  <li key={id} className={q?.status === "archived" ? "line-through text-blekk-3" : ""}>
                    <span className="kicker mr-2">{q?.category} · {q?.format}</span>
                    {q?.content.prompt ?? id}
                  </li>
                );
              })}
            </ol>
            {!g.locked_at && g.players === 0 ? (
              <form action={regenerateAction} className="mt-3">
                <input type="hidden" name="date" value={g.game_date!} />
                <button className="btn btn-ghost !min-h-9 !py-1 text-sm">Lag runden på nytt</button>
              </form>
            ) : null}
          </Card>
        ))}
      </div>
    </div>
  );
}
