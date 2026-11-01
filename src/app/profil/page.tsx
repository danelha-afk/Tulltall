import type { Metadata } from "next";
import { ProfileEditor } from "@/components/site/ProfileEditor";
import { t } from "@/lib/i18n";

export const metadata: Metadata = { title: t("profile.title"), robots: { index: false } };

export default function ProfilePage() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <h1 className="font-black font-wide uppercase text-4xl mb-8">{t("profile.title")}</h1>
      <ProfileEditor />
    </div>
  );
}
