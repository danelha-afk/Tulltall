import Link from "next/link";
import { LogoMark } from "@/components/ui/Logo";
import { HeaderMenu } from "./HeaderMenu";

/** Rolig topplinje: logo og meny – ingenting som konkurrerer med spørsmålet. */
export function Header() {
  return (
    <header className="sticky top-0 z-40 bg-papir/95 border-b-[2.5px] border-blekk">
      <div className="mx-auto max-w-5xl flex items-center justify-between gap-3 px-4 h-14">
        <Link href="/" className="flex items-center gap-2 font-black font-wide uppercase text-[0.95rem] tracking-tight whitespace-nowrap" aria-label="TULL ELLER TALL? – til forsiden">
          <LogoMark className="text-[0.95rem] py-1" />
          <span>Tull eller tall</span>
        </Link>
        <HeaderMenu />
      </div>
    </header>
  );
}
