"use client";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { t } from "@/lib/i18n";
import { store } from "@/lib/client/storage";

/** Valgfritt kallenavn for resultatlisten før man tar utfordringen. */
export function ChallengeNickname({ code }: { code: string }) {
  const router = useRouter();
  const [nick, setNick] = useState("");
  useEffect(() => setNick(store.getNickname()), []);
  return (
    <form
      className="mt-6 grid gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        store.setNickname(nick.trim().slice(0, 24));
        store.setRef(`ch:${code}`);
        router.push(`/spill?u=${code}`);
      }}
    >
      <label className="grid gap-1">
        <span className="kicker">{t("result.nicknameLabel")}</span>
        <input
          value={nick}
          maxLength={24}
          onChange={(e) => setNick(e.target.value)}
          placeholder={t("result.nicknamePlaceholder")}
          className="h-12 rounded-full border-[2.5px] border-blekk bg-papir px-4 font-bold"
        />
      </label>
      <button type="submit" className="btn btn-primary text-xl">
        {t("challenge.cta")} →
      </button>
    </form>
  );
}
