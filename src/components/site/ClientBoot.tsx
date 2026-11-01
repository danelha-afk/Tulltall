"use client";
import { useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { track } from "@/lib/client/track";
import { store } from "@/lib/client/storage";

/** Registrerer service worker, husker henvisning (ref) og måler sidevisninger anonymt. */
export function ClientBoot() {
  const pathname = usePathname();
  const params = useSearchParams();

  useEffect(() => {
    const ref = params.get("ref");
    if (ref && /^[a-z0-9:_-]{1,80}$/i.test(ref)) {
      store.setRef(ref);
      return;
    }
    // Delelenkene er rene (tulltall.no/u/kode og /s/spørsmål), så henvisningen leses fra stien.
    const fromPath = pathname.match(/^\/u\/([a-z0-9]{6,12})$/) ?? null;
    const fromQuestion = pathname.match(/^\/s\/([a-z0-9][a-z0-9-]{2,80})$/) ?? null;
    if (fromPath) store.setRef(`ch:${fromPath[1]}`);
    else if (fromQuestion) store.setRef(`q:${fromQuestion[1]}`);
  }, [params, pathname]);

  useEffect(() => {
    track("page_view");
  }, [pathname]);

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    if (process.env.NODE_ENV !== "production" && !process.env.NEXT_PUBLIC_SW_DEV) return;
    navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => undefined);
  }, []);
  return null;
}
