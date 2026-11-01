"use client";
import { useEffect, useState } from "react";
import { t } from "@/lib/i18n";
import { api } from "@/lib/client/api";
import { store } from "@/lib/client/storage";
import { track } from "@/lib/client/track";

function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(b64);
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

/** Varsel tilbys først etter en fullført runde, og bare når brukeren selv trykker. */
export function PushOptIn() {
  const key = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const [state, setState] = useState<"idle" | "done" | "denied" | "unsupported" | "hidden">("hidden");
  useEffect(() => {
    if (!key) return;
    if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
      setState(/iphone|ipad/i.test(navigator.userAgent) ? "unsupported" : "hidden");
      return;
    }
    setState(Notification.permission === "granted" ? "done" : Notification.permission === "denied" ? "denied" : "idle");
  }, [key]);
  if (state === "hidden") return null;
  const enable = async () => {
    try {
      const perm = await Notification.requestPermission();
      if (perm !== "granted") return setState("denied");
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(key!) });
      await api.subscribePush(sub.toJSON(), store.getPlayerId());
      track("push_optin");
      setState("done");
    } catch {
      setState("denied");
    }
  };
  return (
    <div className="mt-8 rounded-2xl border-2 border-dashed border-blekk p-4 text-center">
      {state === "idle" ? (
        <>
          <p className="font-bold">{t("result.pushTitle")}</p>
          <button type="button" className="btn btn-acid mt-3" onClick={() => void enable()}>
            {t("result.pushCta")}
          </button>
        </>
      ) : (
        <p className="font-bold">{state === "done" ? t("result.pushDone") : state === "denied" ? t("result.pushDenied") : t("result.pushUnsupported")}</p>
      )}
    </div>
  );
}
