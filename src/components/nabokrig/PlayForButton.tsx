"use client";
import { useRouter } from "next/navigation";
import { t } from "@/lib/i18n";
import { api } from "@/lib/client/api";
import { store } from "@/lib/client/storage";
import { track } from "@/lib/client/track";

/** Velger kommunen (som «heier» hvis ikke annet er valgt) og starter dagens runde. */
export function PlayForButton({ kommune }: { kommune: { nr: string; name: string; slug: string } }) {
  const router = useRouter();
  return (
    <button
      type="button"
      className="btn btn-primary w-full"
      onClick={async () => {
        const prev = store.getKommune();
        const relation = prev?.nr === kommune.nr ? prev.relation : "heier";
        try {
          const res = await api.player({ playerId: store.getPlayerId(), kommuneNr: kommune.nr, relation });
          store.setPlayerId(res.playerId);
        } catch {
          /* valget lagres lokalt uansett */
        }
        store.setKommune({ ...kommune, relation });
        track("nabokrig_join", { kommune: kommune.nr, relation });
        router.push("/spill");
      }}
    >
      {t("nabokrig.playFor", { kommune: kommune.name })} →
    </button>
  );
}
