import { getDb } from "@/lib/db/client";
import { hidePlayerAction, resetPlayerNameAction } from "../../actions";
import { Card } from "../ui";

export default async function Names() {
  const rows = await (await getDb()).query<{ id: string; handle: string | null; handle_custom: boolean; show_on_lists: boolean; hidden_by_admin: boolean; last_seen_at: Date; runs: number }>(
    `SELECT p.id, p.handle, p.handle_custom, p.show_on_lists, p.hidden_by_admin, p.last_seen_at,
            (SELECT count(*)::int FROM sessions s WHERE s.player_id = p.id AND s.finished_at IS NOT NULL) AS runs
     FROM players p WHERE p.show_on_lists OR p.hidden_by_admin ORDER BY p.last_seen_at DESC LIMIT 200`,
  );
  return (
    <div>
      <h1 className="font-black font-wide uppercase text-3xl">Navn og lister</h1>
      <p className="mt-2 max-w-2xl text-blekk-2">
        Spillere som har sagt ja til å vises på topplistene. Egne navn går gjennom et filter, men du kan skjule en spiller eller sette tilbake til et tilfeldig navn.
      </p>
      <div className="mt-6 grid gap-3">
        {rows.map((r) => (
          <Card key={r.id}>
            <div className="flex flex-wrap items-center gap-3 justify-between">
              <div>
                <p className="font-black text-lg">{r.handle} {r.handle_custom ? <span className="kicker">selvvalgt</span> : <span className="kicker">generert</span>}</p>
                <p className="text-sm text-blekk-2">{r.runs} runder · sist sett {r.last_seen_at.toISOString().slice(0, 10)} {r.hidden_by_admin ? "· SKJULT" : ""}</p>
              </div>
              <div className="flex gap-2">
                <form action={hidePlayerAction}>
                  <input type="hidden" name="id" value={r.id} />
                  <input type="hidden" name="hide" value={r.hidden_by_admin ? "0" : "1"} />
                  <button className="btn btn-ghost !min-h-9 !py-1 text-sm">{r.hidden_by_admin ? "Vis igjen" : "Skjul"}</button>
                </form>
                {r.handle_custom ? (
                  <form action={resetPlayerNameAction}>
                    <input type="hidden" name="id" value={r.id} />
                    <button className="btn btn-hot !min-h-9 !py-1 text-sm">Nullstill navn</button>
                  </form>
                ) : null}
              </div>
            </div>
          </Card>
        ))}
        {rows.length === 0 ? <p className="font-bold">Ingen spillere er på listene ennå.</p> : null}
      </div>
    </div>
  );
}
