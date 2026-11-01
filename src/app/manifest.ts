import type { MetadataRoute } from "next";
import { brand } from "@/lib/config/brand";
import { t } from "@/lib/i18n";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: brand.name,
    short_name: brand.shortName,
    description: t("meta.description"),
    lang: "nb",
    start_url: "/?ref=pwa",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#f4ede0",
    theme_color: "#2b3bff",
    categories: ["games", "education", "entertainment"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: t("nav.today"), url: "/spill?ref=pwa-shortcut", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
      { name: t("nav.nabokrigen"), url: "/nabokrigen?ref=pwa-shortcut", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
    ],
  };
}
