import Link from "next/link";
import { t } from "@/lib/i18n";
import { brand } from "@/lib/config/brand";
import { ConsentLink } from "./ConsentBanner";

export function Footer() {
  return (
    <footer className="mt-24 border-t-[2.5px] border-blekk bg-blekk text-papir">
      <div className="mx-auto max-w-5xl px-4 py-10 grid gap-6 sm:grid-cols-[1.4fr_1fr]">
        <div>
          <p className="font-black font-wide uppercase text-2xl leading-none">{brand.name}</p>
          <p className="serif-soft italic text-papir/85 mt-2">{brand.tagline}</p>
        </div>
        <ul className="grid grid-cols-2 gap-x-4 gap-y-3 font-bold content-start">
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
