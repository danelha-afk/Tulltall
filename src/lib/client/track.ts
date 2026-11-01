"use client";
/** Hendelsesmåling. Uten samtykke sendes ingen spiller-ID – bare anonyme tellinger. */
import { store } from "./storage";

type Props = Record<string, string | number | boolean | null>;
interface Ev {
  name: string;
  path?: string;
  ref?: string | null;
  sessionId?: string | null;
  props?: Props;
  variants?: Record<string, string>;
}

let queue: Ev[] = [];
let timer: ReturnType<typeof setTimeout> | null = null;
let variants: Record<string, string> = {};

export function setVariants(v: Record<string, string>) {
  variants = v ?? {};
}

function flush() {
  timer = null;
  if (queue.length === 0) return;
  const consent = store.getConsent();
  const body = JSON.stringify({
    events: queue.splice(0, 30),
    playerId: consent?.analytics ? store.getPlayerId() : null,
  });
  try {
    if (navigator.sendBeacon) {
      const ok = navigator.sendBeacon("/api/events", new Blob([body], { type: "application/json" }));
      if (ok) return;
    }
    void fetch("/api/events", { method: "POST", body, headers: { "Content-Type": "application/json" }, keepalive: true });
  } catch {
    /* måling skal aldri påvirke spillet */
  }
}

export function track(name: string, props?: Props, extra?: { sessionId?: string | null }) {
  if (typeof window === "undefined") return;
  queue.push({
    name,
    path: window.location.pathname.slice(0, 200),
    ref: store.getRef(),
    sessionId: extra?.sessionId ?? null,
    props,
    variants,
  });
  if (queue.length >= 10) flush();
  else if (!timer) timer = setTimeout(flush, 1500);
}

if (typeof window !== "undefined") {
  window.addEventListener("pagehide", flush);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") flush();
  });
}
