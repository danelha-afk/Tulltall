"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { t, formatNumber } from "@/lib/i18n";
import { api, ApiError } from "@/lib/client/api";
import { store } from "@/lib/client/storage";
import type { Profile } from "@/lib/profile/service";

export function ProfileEditor() {
  const [id, setId] = useState<string | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [name, setName] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [removed, setRemoved] = useState(false);

  useEffect(() => {
    const pid = store.getPlayerId();
    setId(pid);
    if (pid) api.profile({ playerId: pid, action: "get" }).then((r) => { setProfile(r.profile); setName(r.profile.handle); }).catch(() => undefined);
  }, []);

  const update = async (patch: { showOnLists?: boolean; customName?: string | null }) => {
    if (!id) return;
    setMsg(null);
    try {
      const r = await api.profile({ playerId: id, action: "update", ...patch });
      setProfile(r.profile);
      setName(r.profile.handle);
      setMsg({ ok: true, text: t("profile.saved") });
    } catch (err) {
      const code = err instanceof ApiError ? err.code : "generic";
      const key = (["short", "long", "chars", "blocked", "personal", "taken"].includes(code) ? code : "generic") as "short";
      setMsg({ ok: false, text: t(`profile.errors.${key}`) });
    }
  };

  if (removed) return <p className="font-bold text-lg">{t("profile.removed")}</p>;
  if (!id || !profile) {
    return (
      <div>
        <p className="text-lg">{t("top.play")}</p>
        <Link href="/spill" className="btn btn-primary mt-4">{t("nav.today")} →</Link>
      </div>
    );
  }
  return (
    <div className="grid gap-8 max-w-md">
      <section>
        <h2 className="font-bold text-blekk-2">{t("profile.yourName")}</h2>
        <p className="font-black text-3xl leading-tight mt-1" data-testid="profile-handle">{profile.handle}</p>
        {!profile.custom ? <p className="text-blekk-2 mt-1">{t("profile.generatedNote")}</p> : null}
        <form
          className="mt-4 grid gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            void update({ customName: name });
          }}
        >
          <label className="grid gap-1">
            <span className="font-semibold">{t("profile.chooseOwn")}</span>
            <input value={name} maxLength={20} onChange={(e) => setName(e.target.value)} className="h-14 rounded-full border-[2.5px] border-blekk bg-papir px-5 text-lg font-bold" />
          </label>
          <div className="flex flex-wrap gap-3">
            <button type="submit" className="btn btn-primary">{t("profile.save")}</button>
            <button type="button" className="btn btn-ghost" onClick={() => void update({ customName: null })}>{t("profile.newRandom")}</button>
          </div>
          {msg ? <p className={`font-bold ${msg.ok ? "" : "text-korall-dyp"}`} role="status">{msg.text}</p> : null}
        </form>
      </section>

      <section className="rounded-2xl border-[2.5px] border-blekk bg-papir p-4">
        <label className="flex items-start gap-3 cursor-pointer">
          <input type="checkbox" className="w-7 h-7 mt-0.5 accent-kobolt" checked={profile.showOnLists} disabled={profile.hidden} onChange={(e) => void update({ showOnLists: e.target.checked })} />
          <span>
            <span className="block font-black text-lg">{t("profile.show")}</span>
            <span className="block text-blekk-2">{profile.hidden ? t("profile.hidden") : t("profile.showHint")}</span>
          </span>
        </label>
      </section>

      <dl className="grid grid-cols-2 gap-3">
        <div className="rounded-xl border-2 border-blekk bg-papir p-3"><dt className="text-blekk-2">{t("profile.runs")}</dt><dd className="font-black text-3xl tabular">{formatNumber(profile.runs)}</dd></div>
        <div className="rounded-xl border-2 border-blekk bg-papir p-3"><dt className="text-blekk-2">{t("profile.best")}</dt><dd className="font-black text-3xl tabular">{profile.best !== null ? formatNumber(profile.best) : "–"}</dd></div>
      </dl>

      <button
        type="button"
        className="underline underline-offset-4 text-blekk-2 text-left w-fit"
        onClick={async () => {
          await api.deletePlayer(id).catch(() => undefined);
          store.clearHistory();
          store.setKommune(null);
          setRemoved(true);
        }}
      >
        {t("profile.remove")}
      </button>
    </div>
  );
}
