"use client";
import { useEffect, useState } from "react";
import { t } from "@/lib/i18n";
import { store, type Consent } from "@/lib/client/storage";

const OPEN_EVENT = "tt:open-consent";

/**
 * Samtykke uten mørke mønstre: like store valg, ingen forhåndsavkrysning, kan endres når som helst.
 * Vises ikke før spilleren har fullført en runde (eller åpner innstillingene selv), så det aldri
 * står i veien for å starte spillet.
 */
export function ConsentBanner() {
  const [open, setOpen] = useState(false);
  const [custom, setCustom] = useState(false);
  const [analytics, setAnalytics] = useState(false);
  const [ads, setAds] = useState(false);

  useEffect(() => {
    const show = () => {
      const c = store.getConsent();
      setAnalytics(c?.analytics ?? false);
      setAds(c?.ads ?? false);
      setOpen(true);
    };
    const onFinished = () => {
      if (!store.getConsent()) show();
    };
    window.addEventListener(OPEN_EVENT, show);
    window.addEventListener("tt:round-finished", onFinished);
    return () => {
      window.removeEventListener(OPEN_EVENT, show);
      window.removeEventListener("tt:round-finished", onFinished);
    };
  }, []);

  const save = (c: Omit<Consent, "v" | "at">) => {
    store.setConsent({ v: 1, at: new Date().toISOString(), ...c });
    window.dispatchEvent(new CustomEvent("tt:consent", { detail: c }));
    setOpen(false);
    setCustom(false);
  };

  if (!open) return null;
  return (
    <div role="dialog" aria-modal="false" aria-labelledby="consent-title" className="fixed inset-x-0 bottom-0 z-50 p-3 sm:p-5 pointer-events-none">
      <div className="pointer-events-auto mx-auto max-w-xl bg-papir border-[2.5px] border-blekk rounded-2xl shadow-[6px_6px_0_var(--color-blekk)] p-5">
        <h2 id="consent-title" className="font-black font-wide uppercase text-lg">{t("consent.title")}</h2>
        <p className="serif-soft mt-2 text-[0.98rem] leading-snug">{t("consent.text")}</p>
        {custom ? (
          <div className="mt-4 space-y-2">
            <label className="flex items-center gap-3 font-bold">
              <input type="checkbox" className="w-5 h-5 accent-kobolt" checked={analytics} onChange={(e) => setAnalytics(e.target.checked)} />
              {t("consent.analytics")}
            </label>
            <label className="flex items-center gap-3 font-bold">
              <input type="checkbox" className="w-5 h-5 accent-kobolt" checked={ads} onChange={(e) => setAds(e.target.checked)} />
              {t("consent.ads")}
            </label>
            <button type="button" className="btn btn-primary mt-2 w-full" onClick={() => save({ analytics, ads })}>
              {t("consent.save")}
            </button>
          </div>
        ) : (
          <div className="mt-4 grid grid-cols-2 gap-2">
            <button type="button" className="btn btn-ghost" onClick={() => save({ analytics: false, ads: false })}>
              {t("consent.reject")}
            </button>
            <button type="button" className="btn btn-ghost" onClick={() => save({ analytics: true, ads: false })}>
              {t("consent.accept")}
            </button>
            <button type="button" className="col-span-2 kicker underline underline-offset-4 py-2" onClick={() => setCustom(true)}>
              {t("consent.customize")}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export function ConsentLink() {
  return (
    <button type="button" className="hover:text-syre text-left" onClick={() => window.dispatchEvent(new Event(OPEN_EVENT))}>
      {t("nav.settings")}
    </button>
  );
}
