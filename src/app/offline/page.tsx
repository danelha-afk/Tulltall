import Link from "next/link";
import { t } from "@/lib/i18n";

export const metadata = { title: t("offline.title"), robots: { index: false } };

export default function Offline() {
  return (
    <div className="mx-auto max-w-md px-4 py-20 text-center">
      <p className="text-6xl font-black font-wide" aria-hidden>
        T?LL
      </p>
      <h1 className="font-black font-wide uppercase text-3xl mt-6">{t("offline.title")}</h1>
      <p className="serif-soft text-lg mt-3">{t("offline.text")}</p>
      <div className="mt-8 flex justify-center gap-3">
        <Link href="/historikk" className="btn btn-ghost">
          {t("nav.history")}
        </Link>
        <Link href="/" className="btn btn-primary">
          {t("offline.retry")}
        </Link>
      </div>
    </div>
  );
}
