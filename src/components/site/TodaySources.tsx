"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { t } from "@/lib/i18n";
import { api } from "@/lib/client/api";
import { store } from "@/lib/client/storage";
import { localDate } from "@/lib/game/dates";
import type { RevealData } from "@/lib/game/public";

type Item = RevealData & { prompt: string };

/**
 * Kildene til dagens spørsmål. De vises først når du har spilt ferdig dagens runde (da har du fått fasiten
 * uansett), slik at listen ikke gir bort svar på forhånd. Alle andre får dem i morgen, i den vanlige listen.
 */
export function TodaySources() {
  const [state, setState] = useState<"loading" | "locked" | "ready">("loading");
  const [items, setItems] = useState<Item[]>([]);

  useEffect(() => {
    const today = localDate();
    const entry = store.getHistory().find((h) => h.kind === "daily" && h.date === today);
    const sess = entry ? store.getSession(entry.gameId) : null;
    if (!sess) {
      setState("locked");
      return;
    }
    api
      .summary(sess.sessionId, sess.token)
      .then((sum) => {
        setItems(sum.reveals);
        setState("ready");
      })
      .catch(() => setState("locked"));
  }, []);

  return (
    <section className="mt-10 rounded-2xl border-[2.5px] border-blekk bg-syre p-5 shadow-[5px_5px_0_var(--color-blekk)]">
      <h2 className="font-black font-wide uppercase text-xl">{t("sources.todayTitle")}</h2>
      {state === "loading" ? <p className="mt-3" aria-busy="true">&nbsp;</p> : null}
      {state === "locked" ? (
        <>
          <p className="mt-3 text-lg">{t("sources.todayLocked")}</p>
          <Link href="/spill" className="btn btn-primary mt-4">
            {t("sources.play")} →
          </Link>
        </>
      ) : null}
      {state === "ready" ? (
        <ul className="mt-4 grid gap-4">
          {items.map((r) => (
            <li key={r.questionId} data-testid="today-source">
              <p className="font-bold">{r.prompt}</p>
              <ul className="mt-1 grid gap-1 text-sm">
                {r.sources.map((s) => (
                  <li key={s.url}>
                    <a href={s.url} target="_blank" rel="noopener noreferrer" className="font-bold text-kobolt-dyp underline underline-offset-2 break-words">
                      {s.publisher}: {s.title}
                    </a>
                    <span className="text-blekk-2">
                      {" "}
                      · {r.referencePeriod} · {t("game.lastVerified").toLowerCase()} {r.lastVerified}
                    </span>
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
