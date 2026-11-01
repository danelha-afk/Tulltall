"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { t } from "@/lib/i18n";
import { InstallButton } from "./InstallButton";

export function HeaderMenu() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    const onClick = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setOpen(false);
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onClick);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onClick);
    };
  }, [open]);
  const links: [string, string][] = [
    ["/spill", t("nav.today")],
    ["/nabokrigen", t("nav.nabokrigen")],
    ["/historikk", t("nav.history")],
    ["/om", t("nav.about")],
    ["/kilder", t("nav.sources")],
    ["/personvern", t("nav.privacy")],
  ];
  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-expanded={open}
        aria-controls="hovedmeny"
        onClick={() => setOpen((o) => !o)}
        className="grid place-items-center w-10 h-10 rounded-full border-2 border-blekk bg-papir hover:bg-syre"
      >
        <span className="sr-only">{open ? t("nav.close") : t("nav.menu")}</span>
        <svg width="18" height="14" viewBox="0 0 18 14" aria-hidden>
          <path d={open ? "M2 1 L16 13 M16 1 L2 13" : "M0 2h18M0 7h12M0 12h18"} stroke="currentColor" strokeWidth="2.5" fill="none" strokeLinecap="round" />
        </svg>
      </button>
      {open ? (
        <div id="hovedmeny" className="absolute right-0 mt-2 w-64 bg-papir border-[2.5px] border-blekk rounded-2xl shadow-[5px_5px_0_var(--color-blekk)] p-2 z-50">
          <ul className="flex flex-col">
            {links.map(([href, label]) => (
              <li key={href}>
                <Link href={href} onClick={() => setOpen(false)} className="block px-3 py-2.5 rounded-xl font-bold hover:bg-syre">
                  {label}
                </Link>
              </li>
            ))}
          </ul>
          <div className="border-t-2 border-dashed border-blekk/40 mt-2 pt-2">
            <InstallButton />
          </div>
        </div>
      ) : null}
    </div>
  );
}
