"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { t } from "@/lib/i18n";
import { store, type KommuneChoice } from "@/lib/client/storage";

export function KommuneBadge() {
  const [k, setK] = useState<KommuneChoice | null>(null);
  useEffect(() => setK(store.getKommune()), []);
  return k ? (
    <Link href={`/kommune/${k.slug}`} className="btn btn-ghost">
      {t("home.nabokrigCurrent", { kommune: k.name })}
    </Link>
  ) : (
    <Link href="/nabokrigen#velg" className="btn btn-acid">
      {t("home.nabokrigCta")} →
    </Link>
  );
}
