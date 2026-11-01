import type { Metadata } from "next";
import { History } from "@/components/site/History";
import { t } from "@/lib/i18n";

export const metadata: Metadata = { title: t("history.title"), robots: { index: false } };

export default function HistoryPage() {
  return <History />;
}
