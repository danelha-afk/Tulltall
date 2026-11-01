import Link from "next/link";
import { t } from "@/lib/i18n";
import { LogoMark } from "@/components/ui/Logo";
import { HeaderMenu } from "./HeaderMenu";

export function Header() {
  return (
    <header className="sticky top-0 z-40 bg-papir/90 backdrop-blur-[2px] border-b-[2.5px] border-blekk">
      <div className="mx-auto max-w-5xl flex items-center justify-between gap-3 px-4 h-14">
        <Link href="/" className="flex items-center gap-2 font-black font-wide uppercase text-[0.95rem] tracking-tight" aria-label="TULL ELLER TALL? – til forsiden">
          <LogoMark className="text-[0.95rem] py-1" />
          <span className="hidden min-[400px]:inline">Tull eller tall</span>
        </Link>
        <nav aria-label="Hovedmeny" className="flex items-center gap-1.5">
          <Link href="/spill" className="hidden sm:inline-flex kicker px-3 py-2 rounded-full border-2 border-blekk bg-syre hover:bg-kobolt hover:text-papir transition-colors">
            {t("nav.today")}
          </Link>
          <Link href="/nabokrigen" className="kicker px-3 py-2 rounded-full border-2 border-blekk hover:bg-blekk hover:text-papir transition-colors">
            {t("nav.nabokrigen")}
          </Link>
          <HeaderMenu />
        </nav>
      </div>
    </header>
  );
}
