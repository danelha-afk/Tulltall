import { ImageResponse } from "next/og";
import { ogFonts, OG } from "@/lib/og/fonts";

export const alt = "TULL ELLER TALL? – Du tror du vet. Men gjør du det?";
export const size = OG.size;
export const contentType = "image/png";

export default async function Image() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", background: OG.papir, padding: 72, fontFamily: "Archivo" }}>
        <div style={{ display: "flex", flexDirection: "column", fontSize: 168, fontWeight: 800, lineHeight: 0.84, color: OG.blekk }}>
          <span style={{ display: "flex" }}>
            T<span style={{ color: OG.kobolt }}>U</span>LL
          </span>
          <span style={{ fontSize: 48, fontWeight: 500, color: OG.kobolt, marginLeft: 120 }}>eller</span>
          <span style={{ display: "flex" }}>
            T<span style={{ color: OG.korall }}>A</span>LL?
          </span>
        </div>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 24 }}>
          <div style={{ width: 300, height: 300, borderRadius: 999, background: OG.syre, border: `8px solid ${OG.blekk}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 40, fontWeight: 800, textAlign: "center", color: OG.blekk }}>
            Du tror du vet.
          </div>
          <span style={{ fontFamily: "Martian", fontSize: 28, color: OG.blekk }}>10 SPØRSMÅL OM DAGEN</span>
        </div>
      </div>
    ),
    { ...size, fonts: await ogFonts() },
  );
}
