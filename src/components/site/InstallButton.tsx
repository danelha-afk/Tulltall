"use client";
import { useEffect, useState } from "react";
import { t } from "@/lib/i18n";
import { track } from "@/lib/client/track";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

let deferred: BeforeInstallPromptEvent | null = null;
if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferred = e as BeforeInstallPromptEvent;
  });
}

export function InstallButton() {
  const [state, setState] = useState<"hidden" | "prompt" | "ios">("hidden");
  const [showIos, setShowIos] = useState(false);
  useEffect(() => {
    const standalone = window.matchMedia("(display-mode: standalone)").matches;
    if (standalone) return;
    const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
    setState(deferred ? "prompt" : ios ? "ios" : "hidden");
  }, []);
  if (state === "hidden") return null;
  return (
    <div>
      <button
        type="button"
        className="w-full text-left px-3 py-2.5 rounded-xl font-bold hover:bg-syre"
        onClick={async () => {
          if (state === "ios") return setShowIos((s) => !s);
          if (!deferred) return;
          track("install_prompt");
          await deferred.prompt();
          const choice = await deferred.userChoice;
          if (choice.outcome === "accepted") track("install_accepted");
          deferred = null;
          setState("hidden");
        }}
      >
        ⤓ {t("install.cta")}
      </button>
      {showIos ? <p className="px-3 pb-2 text-sm text-blekk-2">{t("install.ios")}</p> : null}
    </div>
  );
}
