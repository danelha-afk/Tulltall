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

  const restored = (playerId: string, p: Profile) => {
    store.setPlayerId(playerId);
    setId(playerId);
    setProfile(p);
    setName(p.handle);
    setMsg({ ok: true, text: t("profile.recovery.restored") });
  };

  if (removed) return <p className="font-bold text-lg">{t("profile.removed")}</p>;
  if (!id || !profile) {
    return (
      <div className="grid gap-8 max-w-md">
        <div>
          <p className="text-lg">{t("top.play")}</p>
          <Link href="/spill" className="btn btn-primary mt-4">{t("nav.today")} →</Link>
        </div>
        <RecoverySection id={null} onRestored={restored} />
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

      <RecoverySection id={id} onRestored={restored} />

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

/** Ta med profilen til en ny enhet eller adresse: lag en kode her, bruk den der. */
function RecoverySection({ id, onRestored }: { id: string | null; onRestored: (playerId: string, profile: Profile) => void }) {
  const [code, setCode] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [input, setInput] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const create = async () => {
    if (!id) return;
    setBusy(true);
    try {
      const r = await api.profile({ playerId: id, action: "recovery" });
      setCode(r.code ?? null);
    } finally {
      setBusy(false);
    }
  };
  const restore = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    setBusy(true);
    try {
      const r = await api.restoreProfile(input);
      onRestored(r.playerId, r.profile);
      setInput("");
      setCode(null);
    } catch {
      setErr(t("profile.recovery.notFound"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section id="gjenopprett" className="rounded-2xl border-[2.5px] border-blekk bg-papir-2 p-4 grid gap-4">
      <h2 className="font-black text-lg">{t("profile.recovery.title")}</h2>
      <p className="text-blekk-2">{t("profile.recovery.text")}</p>
      {id ? (
        code ? (
          <div className="grid gap-2">
            <p className="font-semibold">{t("profile.recovery.yourCode")}</p>
            <p data-testid="recovery-code" className="font-mono font-black text-2xl tracking-wider bg-syre rounded-xl border-2 border-blekk px-3 py-2 break-all">{code}</p>
            <p className="text-blekk-2 text-sm">{t("profile.recovery.keep")}</p>
            <button
              type="button"
              className="btn btn-ghost w-fit"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(code);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 2000);
                } catch {
                  /* bruker kan merke og kopiere selv */
                }
              }}
            >
              {copied ? t("profile.recovery.copied") : t("profile.recovery.copy")}
            </button>
          </div>
        ) : (
          <button type="button" className="btn btn-primary w-fit" disabled={busy} onClick={() => void create()}>
            {t("profile.recovery.create")}
          </button>
        )
      ) : null}
      <form className="grid gap-2" onSubmit={(e) => void restore(e)}>
        <label className="grid gap-1">
          <span className="font-semibold">{t("profile.recovery.haveCode")}</span>
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            aria-label={t("profile.recovery.codeLabel")}
            placeholder="xxxx-xxxx-xxxx"
            className="h-14 rounded-full border-[2.5px] border-blekk bg-papir px-5 text-lg font-bold font-mono"
          />
        </label>
        <button type="submit" className="btn btn-ghost w-fit" disabled={busy || input.trim().length < 8}>
          {t("profile.recovery.restore")}
        </button>
        {err ? <p role="alert" className="font-bold text-korall-dyp">{err}</p> : null}
      </form>
    </section>
  );
}
