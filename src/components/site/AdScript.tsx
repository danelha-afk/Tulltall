"use client";
import { useEffect, useState } from "react";
import { store } from "@/lib/client/storage";

/**
 * Laster Google AdSense bare når annonser er slått på i miljøet. Personlig tilpassede annonser
 * krever samtykke; uten samtykke ber vi om ikke-personlige annonser. I EØS må Googles
 * sertifiserte samtykkeløsning (Privacy & messaging) i tillegg være aktivert – se docs/annonser.md.
 */
export function AdScript() {
  const client = process.env.NEXT_PUBLIC_ADSENSE_CLIENT;
  const [ready, setReady] = useState(false);
  useEffect(() => {
    if (!client) return;
    const apply = () => {
      const consent = store.getConsent();
      const w = window as unknown as { adsbygoogle?: unknown[] & { requestNonPersonalizedAds?: number } };
      w.adsbygoogle = w.adsbygoogle || ([] as unknown[]);
      (w.adsbygoogle as { requestNonPersonalizedAds?: number }).requestNonPersonalizedAds = consent?.ads ? 0 : 1;
      setReady(true);
    };
    apply();
    window.addEventListener("tt:consent", apply);
    return () => window.removeEventListener("tt:consent", apply);
  }, [client]);
  useEffect(() => {
    if (!client || !ready || document.getElementById("adsbygoogle-js")) return;
    const s = document.createElement("script");
    s.id = "adsbygoogle-js";
    s.async = true;
    s.crossOrigin = "anonymous";
    s.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${encodeURIComponent(client)}`;
    document.head.appendChild(s);
  }, [client, ready]);
  return null;
}
