import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { Suspense } from "react";
import "./globals.css";
import { brand } from "@/lib/config/brand";
import { t } from "@/lib/i18n";
import { Header } from "@/components/site/Header";
import { Footer } from "@/components/site/Footer";
import { ConsentBanner } from "@/components/site/ConsentBanner";
import { ClientBoot } from "@/components/site/ClientBoot";
import { InkFilters } from "@/components/ui/Stamp";
import { AdScript } from "@/components/site/AdScript";

const archivo = localFont({
  src: [
    { path: "../fonts/archivo-latin-standard-normal.woff2", style: "normal" },
    { path: "../fonts/archivo-latin-standard-italic.woff2", style: "italic" },
  ],
  variable: "--font-archivo",
  weight: "100 900",
  display: "swap",
  declarations: [{ prop: "font-stretch", value: "62% 125%" }],
});

const fraunces = localFont({
  src: [
    { path: "../fonts/fraunces-latin-full-normal.woff2", style: "normal" },
    { path: "../fonts/fraunces-latin-full-italic.woff2", style: "italic" },
  ],
  variable: "--font-fraunces",
  weight: "100 900",
  display: "swap",
});

const martian = localFont({
  src: [{ path: "../fonts/martian-mono-latin-standard-normal.woff2", style: "normal" }],
  variable: "--font-martian",
  weight: "100 800",
  display: "swap",
  declarations: [{ prop: "font-stretch", value: "75% 112.5%" }],
});

export const metadata: Metadata = {
  metadataBase: new URL(brand.url),
  title: { default: t("meta.title"), template: `%s · ${brand.name}` },
  description: t("meta.description"),
  applicationName: brand.name,
  openGraph: {
    type: "website",
    locale: "nb_NO",
    siteName: brand.name,
    title: t("meta.title"),
    description: t("meta.description"),
  },
  twitter: { card: "summary_large_image" },
  appleWebApp: { capable: true, title: brand.shortName, statusBarStyle: "default" },
  formatDetection: { telephone: false },
  icons: {
    icon: [
      { url: "/icons/favicon.svg", type: "image/svg+xml" },
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
    ],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180" }],
  },
};

export const viewport: Viewport = {
  themeColor: "#f4ede0",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

async function adsEnabled(): Promise<boolean> {
  if (!process.env.NEXT_PUBLIC_ADSENSE_CLIENT || process.env.NEXT_PUBLIC_ADS_ENABLED !== "true") return false;
  try {
    const { getDb } = await import("@/lib/db/client");
    const { getSettings } = await import("@/lib/db/settings");
    return (await getSettings(await getDb())).adsEnabled;
  } catch {
    return false;
  }
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const ads = await adsEnabled();
  return (
    <html lang="nb" className={`${archivo.variable} ${fraunces.variable} ${martian.variable}`}>
      <body data-ads={ads ? "on" : "off"}>
        <a href="#innhold" className="sr-only-focusable font-bold">
          {t("nav.skip")}
        </a>
        <InkFilters />
        <Header />
        <main id="innhold" className="relative">
          {children}
        </main>
        <Footer />
        <ConsentBanner />
        {ads ? <AdScript /> : null}
        <Suspense fallback={null}>
          <ClientBoot />
        </Suspense>
      </body>
    </html>
  );
}
