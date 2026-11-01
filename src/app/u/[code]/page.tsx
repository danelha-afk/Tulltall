import type { Metadata } from "next";
import Link from "next/link";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { getDb } from "@/lib/db/client";
import { getChallengeView } from "@/lib/play/service";
import { recordEvents } from "@/lib/analytics/events";
import { BOT_UA } from "@/lib/http";
import { t, formatNumber } from "@/lib/i18n";
import { Ticket, PunchHoles } from "@/components/ui/Ticket";
import { Stamp } from "@/components/ui/Stamp";
import { ChallengeNickname } from "@/components/game/ChallengeNickname";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ code: string }> }): Promise<Metadata> {
  const { code } = await params;
  const view = await getChallengeView(await getDb(), code);
  if (!view) return { title: t("challenge.notFound") };
  const name = view.creator.nickname ?? t("challenge.anonymous");
  const title = t("challenge.title", { name });
  const description = t("challenge.lead", { name, hits: view.creator.hits, total: view.creator.total });
  return { title, description, openGraph: { title, description }, robots: { index: false } };
}

export default async function ChallengePage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const db = await getDb();
  const view = await getChallengeView(db, code);
  if (!view) notFound();
  const ua = (await headers()).get("user-agent") ?? "";
  if (!BOT_UA.test(ua)) await recordEvents(db, [{ name: "challenge_open", path: `/u/${code}`, ref: `ch:${code}` }], null);
  const name = view.creator.nickname ?? t("challenge.anonymous");
  const pattern = Array.from({ length: view.creator.total }, () => null);

  return (
    <div className="mx-auto max-w-xl px-4 py-10">
      <Ticket tone="korall" stub={<p className="kicker">{t("challenge.noAnswersSpoiler", { name })}</p>}>
        <p className="kicker">TULL ELLER TALL? {view.game.roundNumber ? `· ${t("result.ticketTitle", { n: view.game.roundNumber })}` : ""}</p>
        <h1 className="mt-3 font-black font-semi-condensed uppercase text-[clamp(2.2rem,10vw,3.6rem)] leading-[0.9]">{t("challenge.title", { name })}</h1>
        <p className="serif-soft text-xl mt-4">{t("challenge.lead", { name, hits: view.creator.hits, total: view.creator.total })}</p>
        <div className="mt-5 flex items-center gap-4">
          <span className="text-3xl">
            <Stamp color="blekk" rotate={-5}>
              {view.creator.hits}/{view.creator.total}
            </Stamp>
          </span>
          <PunchHoles pattern={pattern} size={18} />
        </div>
        <ChallengeNickname code={code} />
      </Ticket>

      {view.leaderboard.length > 1 ? (
        <section className="mt-10">
          <h2 className="kicker mb-3">{t("challenge.leaderboard")}</h2>
          <ol className="grid gap-2">
            {view.leaderboard.map((r, i) => (
              <li key={i} className="flex justify-between rounded-xl border-2 border-blekk bg-papir px-4 py-2 font-bold">
                <span>
                  {i + 1}. {r.nickname ?? t("challenge.anonymous")} {r.isCreator ? "★" : ""}
                </span>
                <span className="tabular">{formatNumber(r.score)}</span>
              </li>
            ))}
          </ol>
        </section>
      ) : null}
      <p className="mt-10 text-center">
        <Link href="/" className="kicker underline underline-offset-4">
          {t("nav.today")}
        </Link>
      </p>
    </div>
  );
}
