import { ImageResponse } from "next/og";
import { getDb } from "@/lib/db/client";
import { getQuestionRow } from "@/lib/db/questions";
import { ogFonts, OG } from "@/lib/og/fonts";

export const alt = "Et spørsmål fra TULL ELLER TALL?";
export const size = OG.size;
export const contentType = "image/png";

export default async function Image({ params }: { params: Promise<{ questionId: string }> }) {
  const { questionId } = await params;
  const row = /^[a-z0-9][a-z0-9-]{2,80}$/.test(questionId) ? await getQuestionRow(await getDb(), questionId) : undefined;
  const ok = row && ["approved", "published"].includes(row.status);
  const text = ok ? (row!.content.payload.format === "truefalse" ? row!.content.payload.statement : row!.content.prompt) : "Tull eller tall?";
  const kicker = ok ? (row!.content.kicker ?? "") : "";
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", background: OG.kobolt, padding: 64, fontFamily: "Archivo", color: OG.papir }}>
        <div style={{ display: "flex", justifyContent: "space-between", fontFamily: "Martian", fontSize: 26 }}>
          <span style={{ background: OG.syre, color: OG.blekk, padding: "6px 16px", borderRadius: 999 }}>{kicker.toUpperCase() || "ET SPØRSMÅL TIL DEG"}</span>
          <span>TULL ELLER TALL?</span>
        </div>
        <div style={{ fontSize: text.length > 110 ? 54 : 68, fontWeight: 800, lineHeight: 1.05 }}>{text}</div>
        <div style={{ display: "flex", gap: 24 }}>
          <span style={{ fontSize: 44, fontWeight: 800, color: OG.korall, border: `6px solid ${OG.korall}`, borderRadius: 12, padding: "4px 20px", transform: "rotate(-6deg)" }}>TULL</span>
          <span style={{ fontSize: 44, fontWeight: 800, color: OG.syre, border: `6px solid ${OG.syre}`, borderRadius: 12, padding: "4px 20px", transform: "rotate(5deg)" }}>TALL</span>
        </div>
      </div>
    ),
    { ...size, fonts: await ogFonts() },
  );
}
