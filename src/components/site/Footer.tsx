import Link from "next/link";
import { t } from "@/lib/i18n";
import { brand } from "@/lib/config/brand";
import { ConsentLink } from "./ConsentBanner";

export function Footer() {
  return (
    <footer className="mt-24 border-t-[2.5px] border-blekk bg-blekk text-papir">
      <div className="overflow-hidden border-b-2 border-papir/20 py-2" aria-hidden>
        <div className="flex w-max animate-marquee kicker text-syre whitespace-nowrap">
          {Array.from({ length: 2 }).map((_, k) => (
            <span key={k} className="flex gap-8 pr-8">
              {["Tull eller tall?", "Du tror du vet", "Men gjør du det?", "Kilder på alt", "Ingen innlogging", "Ingen klokke", "Nytt hver dag"].map((w) => (
                <span key={w}>✦ {w}</span>
              ))}
            </span>
          ))}
        </div>
      </div>
      <div className="mx-auto max-w-5xl px-4 py-10 grid gap-8 sm:grid-cols-[1.4fr_1fr]">
        <div>
          <p className="font-black font-wide uppercase text-2xl leading-none">{brand.name}</p>
          <p className="serif-soft italic text-papir/80 mt-2">{brand.tagline}</p>
          <p className="mt-5 text-sm text-papir/75 max-w-sm">{t("footer.ai")}</p>
          <p className="mt-2 text-sm text-papir/75">{t("footer.madeIn")}</p>
        </div>
        <ul className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm font-bold content-start">
          <li><Link className="hover:text-syre" href="/om">{t("nav.about")}</Link></li>
          <li><Link className="hover:text-syre" href="/kilder">{t("nav.sources")}</Link></li>
          <li><Link className="hover:text-syre" href="/personvern">{t("nav.privacy")}</Link></li>
          <li><Link className="hover:text-syre" href="/historikk">{t("nav.history")}</Link></li>
          <li><Link className="hover:text-syre" href="/nabokrigen">{t("nav.nabokrigen")}</Link></li>
          <li><ConsentLink /></li>
        </ul>
      </div>
    </footer>
  );
}
