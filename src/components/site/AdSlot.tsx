"use client";
import { useEffect, useRef, useState } from "react";
import { t } from "@/lib/i18n";
import { track } from "@/lib/client/track";

/**
 * Annonseplass – alltid tydelig merket, visuelt adskilt fra spillet og aldri inne i
 * spørsmål eller svaralternativer. Rendres ikke i det hele tatt når annonser er av.
 */
export function AdSlot({ placement, slot }: { placement: "result" | "page"; slot?: string }) {
  const client = process.env.NEXT_PUBLIC_ADSENSE_CLIENT;
  const [enabled, setEnabled] = useState(false);
  useEffect(() => {
    setEnabled(process.env.NEXT_PUBLIC_ADS_ENABLED === "true" && document.body.dataset.ads === "on");
  }, []);
  const adSlot = slot ?? (placement === "result" ? process.env.NEXT_PUBLIC_ADSENSE_SLOT_RESULT : process.env.NEXT_PUBLIC_ADSENSE_SLOT_PAGE);
  const ref = useRef<HTMLModElement>(null);
  useEffect(() => {
    if (!client || !enabled || !adSlot || !ref.current) return;
    try {
      const w = window as unknown as { adsbygoogle?: unknown[] };
      (w.adsbygoogle = w.adsbygoogle || []).push({});
      track("ad_impression", { placement });
    } catch {
      /* annonser skal aldri stoppe siden */
    }
  }, [client, enabled, adSlot, placement]);
  if (!client || !enabled || !adSlot) return null;
  return (
    <aside aria-label={t("ads.label")} className="my-10 border-2 border-dashed border-blekk-3 rounded-xl p-3 bg-papir-2/50">
      <p className="kicker text-blekk-3 mb-2">{t("ads.label")}</p>
      <ins
        ref={ref}
        className="adsbygoogle block"
        style={{ display: "block", minHeight: 100 }}
        data-ad-client={client}
        data-ad-slot={adSlot}
        data-ad-format="auto"
        data-full-width-responsive="true"
      />
    </aside>
  );
}
