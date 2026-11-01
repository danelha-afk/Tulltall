import type { Metadata } from "next";
import Link from "next/link";
import { requireAdmin } from "@/lib/admin/auth";
import { logout } from "../actions";

export const metadata: Metadata = { title: "Administrasjon", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

const NAV: [string, string][] = [
  ["/admin", "Oversikt"],
  ["/admin/ko", "Godkjenningskø"],
  ["/admin/sporsmal", "Spørsmålsbank"],
  ["/admin/runder", "Daglige runder"],
  ["/admin/data", "Data og automatisering"],
  ["/admin/analyse", "Analyse og inntekter"],
  ["/admin/innstillinger", "Innstillinger"],
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireAdmin();
  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b-[2.5px] border-blekk pb-4">
        <p className="font-black font-wide uppercase text-xl">Redaksjonen</p>
        <form action={logout}>
          <button className="kicker underline underline-offset-4">Logg ut</button>
        </form>
      </div>
      <nav aria-label="Administrasjon" className="mt-4 flex flex-wrap gap-2">
        {NAV.map(([href, label]) => (
          <Link key={href} href={href} className="rounded-full border-2 border-blekk px-3 py-1.5 text-sm font-bold hover:bg-syre">
            {label}
          </Link>
        ))}
      </nav>
      <div className="mt-8">{children}</div>
    </div>
  );
}
