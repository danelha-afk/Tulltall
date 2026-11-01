import { ImageResponse } from "next/og";
import { getDb } from "@/lib/db/client";
import { getChallengeView } from "@/lib/play/service";
import { ogFonts, OG } from "@/lib/og/fonts";
import { t } from "@/lib/i18n";

export const alt = "Utfordring på TULL ELLER TALL?";
export const size = OG.size;
export const contentType = "image/png";

export default async function Image({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const view = await getChallengeView(await getDb(), code);
  const name = view?.creator.nickname ?? t("challenge.anonymous");
  const hits = view?.creator.hits ?? 0;
  const total = view?.creator.total ?? 10;
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", background: OG.papir, padding: 48, fontFamily: "Archivo" }}>
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            background: OG.korall,
            border: `6px solid ${OG.blekk}`,
            borderRadius: 32,
            padding: 56,
            boxShadow: `14px 14px 0 ${OG.blekk}`,
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", fontFamily: "Martian", fontSize: 26, color: OG.blekk }}>
            <span>TULL ELLER TALL?</span>
            <span>{view?.game.roundNumber ? `BILLETT NR. ${view.game.roundNumber}` : ""}</span>
          </div>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ fontSize: 92, fontWeight: 800, lineHeight: 0.95, color: OG.blekk, textTransform: "uppercase" }}>{`${name} fikk ${hits}/${total}`}</div>
            <div style={{ fontSize: 56, fontWeight: 800, color: OG.papir, marginTop: 18, textShadow: `4px 4px 0 ${OG.blekk}` }}>Klarer du mer?</div>
          </div>
          <div style={{ display: "flex", gap: 14 }}>
            {Array.from({ length: total }).map((_, i) => (
              <div key={i} style={{ width: 44, height: 44, borderRadius: 999, border: `5px solid ${OG.blekk}`, background: OG.papir }} />
            ))}
          </div>
        </div>
      </div>
    ),
    { ...size, fonts: await ogFonts() },
  );
}
