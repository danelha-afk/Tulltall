"use client";
import { useState } from "react";
import { t } from "@/lib/i18n";
import { track } from "@/lib/client/track";

/** Deling via mobilens innebygde delemeny, med kopiering som reserve. Ingen tvang, ingen lokking. */
export function ShareButton({
  url,
  text,
  label,
  kind,
  sessionId,
  small = false,
  variant = "ghost",
}: {
  url: string;
  text: string;
  label: string;
  kind: "question" | "result" | "challenge" | "nabokrig";
  sessionId?: string;
  small?: boolean;
  variant?: "ghost" | "hot" | "acid" | "primary";
}) {
  const [copied, setCopied] = useState(false);
  const absolute = url.startsWith("http") ? url : `${window.location.origin}${url}`;
  const onClick = async () => {
    track("share_click", { kind }, { sessionId });
    const data = { title: "TULL ELLER TALL?", text, url: absolute };
    try {
      if (navigator.share && (!navigator.canShare || navigator.canShare(data))) {
        await navigator.share(data);
        track("share_success", { kind, via: "native" }, { sessionId });
        return;
      }
    } catch (err) {
      if ((err as Error).name === "AbortError") return;
    }
    try {
      await navigator.clipboard.writeText(`${text} ${absolute}`);
      setCopied(true);
      track("share_success", { kind, via: "copy" }, { sessionId });
      setTimeout(() => setCopied(false), 2200);
    } catch {
      window.prompt("Kopier lenken:", absolute);
    }
  };
  return (
    <button type="button" onClick={onClick} className={`btn btn-${variant} ${small ? "!min-h-10 !py-2 text-sm" : ""}`}>
      <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 12v7a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-7" />
        <path d="M16 6l-4-4-4 4" />
        <path d="M12 2v13" />
      </svg>
      <span aria-live="polite">{copied ? t("game.copied") : label}</span>
    </button>
  );
}

export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}
