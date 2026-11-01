"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { t } from "@/lib/i18n";
import { api } from "@/lib/client/api";
import type { Profile } from "@/lib/profile/service";

/** På resultatsiden: ditt spillernavn, din plassering, og ett trykk for å komme på topplisten. */
export function ProfileCard({ playerId }: { playerId: string }) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    api.profile({ playerId, action: "get" }).then((r) => setProfile(r.profile)).catch(() => undefined);
  }, [playerId]);
  if (!profile) return null;
  const join = async () => {
    setBusy(true);
    try {
      const r = await api.profile({ playerId, action: "update", showOnLists: true });
      setProfile(r.profile);
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className="mt-8 rounded-2xl border-[2.5px] border-blekk bg-papir p-5 shadow-[5px_5px_0_var(--color-blekk)]">
      <p className="text-blekk-2 font-semibold">{t("profile.yourName")}</p>
      <p data-testid="my-handle" className="font-black text-[1.7rem] leading-tight">{profile.handle}</p>
      {profile.today ? <p className="mt-1 text-lg">{t("top.yourRank", { rank: profile.today.rank, total: profile.today.total })}</p> : null}
      {profile.showOnLists ? (
        <p className="mt-4 font-bold">
          ✓ {t("top.joined")} · <Link href="/profil" className="underline underline-offset-4">{t("nav.profile")}</Link>
        </p>
      ) : (
        <>
          <button type="button" className="btn btn-primary w-full mt-4 text-xl !min-h-14" disabled={busy} onClick={() => void join()}>
            {t("top.join")}
          </button>
          <p className="mt-2 text-sm text-blekk-2">{t("profile.showHint")}</p>
        </>
      )}
    </section>
  );
}
