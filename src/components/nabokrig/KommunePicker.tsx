"use client";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { t } from "@/lib/i18n";
import { api } from "@/lib/client/api";
import { store, type KommuneChoice } from "@/lib/client/storage";
import { track } from "@/lib/client/track";

interface K {
  nr: string;
  name: string;
  slug: string;
  fylke: string;
  alt: string[];
}

const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/æ/g, "ae").replace(/ø/g, "o").replace(/å/g, "a");

/** Kommunevalg: søk, velg, og si om du bor der eller bare heier. Lagres lokalt og (anonymt) på serveren. */
export function KommunePicker({ preselect }: { preselect?: { nr: string; name: string; slug: string } }) {
  const router = useRouter();
  const [all, setAll] = useState<K[]>([]);
  const [query, setQuery] = useState("");
  const [chosen, setChosen] = useState<K | null>(null);
  const [relation, setRelation] = useState<"bor" | "heier">("heier");
  const [current, setCurrent] = useState<KommuneChoice | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setCurrent(store.getKommune());
    fetch("/api/kommuner")
      .then((r) => r.json())
      .then((list: K[]) => {
        setAll(list);
        if (preselect) setChosen(list.find((k) => k.nr === preselect.nr) ?? null);
      })
      .catch(() => undefined);
  }, [preselect]);

  const hits = useMemo(() => {
    const q = norm(query.trim());
    if (!q) return [];
    return all
      .filter((k) => norm(k.name).includes(q) || k.alt.some((a) => norm(a).includes(q)) || k.nr.startsWith(q))
      .sort((a, b) => Number(!norm(a.name).startsWith(q)) - Number(!norm(b.name).startsWith(q)) || a.name.localeCompare(b.name, "nb"))
      .slice(0, 8);
  }, [all, query]);

  const save = async () => {
    if (!chosen) return;
    setSaving(true);
    try {
      const res = await api.player({ playerId: store.getPlayerId(), kommuneNr: chosen.nr, relation });
      store.setPlayerId(res.playerId);
      const choice: KommuneChoice = { nr: chosen.nr, name: chosen.name, slug: chosen.slug, relation };
      store.setKommune(choice);
      setCurrent(choice);
      track("nabokrig_join", { kommune: chosen.nr, relation });
      router.push("/spill");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div id="velg" className="rounded-2xl border-[2.5px] border-blekk bg-papir p-5 shadow-[5px_5px_0_var(--color-blekk)] scroll-mt-20">
      {current ? (
        <p className="mb-4 font-bold">
          {t("home.nabokrigCurrent", { kommune: current.name })} ·{" "}
          <button type="button" className="underline underline-offset-4" onClick={() => setCurrent(null)}>
            {t("nabokrig.change")}
          </button>
        </p>
      ) : null}
      {!current ? (
        <>
          <h2 className="font-black font-wide uppercase text-xl">{t("nabokrig.choose")}</h2>
          <label className="grid gap-1 mt-4">
            <span className="kicker">{t("nabokrig.searchLabel")}</span>
            <input
              type="search"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setChosen(null);
              }}
              placeholder={t("nabokrig.searchPlaceholder")}
              className="h-12 rounded-full border-[2.5px] border-blekk bg-papir px-4 font-bold"
              aria-controls="kommune-treff"
              autoComplete="off"
            />
          </label>
          {hits.length && !chosen ? (
            <ul id="kommune-treff" className="mt-2 grid gap-1" role="listbox" aria-label={t("nabokrig.searchLabel")}>
              {hits.map((k) => (
                <li key={k.nr}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={false}
                    className="w-full text-left px-4 py-2 rounded-xl hover:bg-syre font-bold flex justify-between gap-2"
                    onClick={() => {
                      setChosen(k);
                      setQuery(k.name);
                    }}
                  >
                    <span>{k.name}</span>
                    <span className="kicker text-blekk-3">{k.fylke}</span>
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
          {chosen ? (
            <fieldset className="mt-5">
              <legend className="kicker">{t("nabokrig.relation")}</legend>
              <div className="mt-2 grid grid-cols-2 gap-2">
                {(["bor", "heier"] as const).map((r) => (
                  <label key={r} className={`flex items-center gap-2 rounded-full border-[2.5px] border-blekk px-4 py-2.5 font-bold cursor-pointer ${relation === r ? "bg-syre" : "bg-papir"}`}>
                    <input type="radio" name="relation" value={r} checked={relation === r} onChange={() => setRelation(r)} className="accent-kobolt" />
                    {r === "bor" ? t("nabokrig.relationBor") : t("nabokrig.relationHeier")}
                  </label>
                ))}
              </div>
              <p className="text-sm text-blekk-2 mt-3">{t("nabokrig.relationNote")}</p>
              <button type="button" className="btn btn-primary mt-4 w-full text-lg" disabled={saving} onClick={() => void save()}>
                {t("nabokrig.save", { kommune: chosen.name })} →
              </button>
            </fieldset>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
