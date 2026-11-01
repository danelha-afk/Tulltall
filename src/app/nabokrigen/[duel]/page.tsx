import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getDb } from "@/lib/db/client";
import { kommuneBySlug, weeklyStandings } from "@/lib/nabokrig/queries";
import { localDate } from "@/lib/game/dates";
import { t, formatNumber } from "@/lib/i18n";
import { ShareButton } from "@/components/game/ShareButton";
import { PlayForButton } from "@/components/nabokrig/PlayForButton";

export const dynamic = "force-dynamic";

async function load(duel: string) {
  const m = /^([a-z0-9-]+)-mot-([a-z0-9-]+)$/.exec(duel);
  if (!m) return null;
  const db = await getDb();
  const [a, b] = await Promise.all([kommuneBySlug(db, m[1]), kommuneBySlug(db, m[2])]);
  if (!a || !b || a.nr === b.nr) return null;
  const rows = await weeklyStandings(db, localDate());
  return { a, b, sa: rows.find((r) => r.nr === a.nr), sb: rows.find((r) => r.nr === b.nr) };
}

export async function generateMetadata({ params }: { params: Promise<{ duel: string }> }): Promise<Metadata> {
  const data = await load((await params).duel);
  if (!data) return {};
  const title = t("nabokrig.duel", { a: data.a.name, b: data.b.name });
  return { title, description: t("nabokrig.challengeKommune", { a: data.a.name, b: data.b.name }) };
}

export default async function Duel({ params }: { params: Promise<{ duel: string }> }) {
  const { duel } = await params;
  const data = await load(duel);
  if (!data) notFound();
  const { a, b, sa, sb } = data;
  const side = (k: typeof a, s: typeof sa, color: string) => (
    <div className={`rounded-2xl border-[2.5px] border-blekk ${color} p-5 shadow-[5px_5px_0_var(--color-blekk)]`}>
      <p className="kicker">{k.fylke_name}</p>
      <h2 className="font-black font-wide uppercase text-[clamp(1.8rem,8vw,3rem)] leading-[0.9] mt-1 break-words">{k.name}</h2>
      <dl className="mt-5 grid grid-cols-3 gap-2 text-center">
        <div>
          <dt className="kicker">{t("nabokrig.score")}</dt>
          <dd className="font-black text-3xl tabular">{s ? s.points.toFixed(1) : "–"}</dd>
        </div>
        <div>
          <dt className="kicker">{t("nabokrig.players")}</dt>
          <dd className="font-black text-3xl tabular">{s ? formatNumber(s.players) : 0}</dd>
        </div>
        <div>
          <dt className="kicker">{t("nabokrig.rank")}</dt>
          <dd className="font-black text-3xl tabular">{s?.rank ?? "–"}</dd>
        </div>
      </dl>
      <div className="mt-5">
        <PlayForButton kommune={{ nr: k.nr, name: k.name, slug: k.slug }} />
      </div>
    </div>
  );
  return (
    <div className="mx-auto max-w-4xl px-4 py-12">
      <p className="kicker text-center">{t("nabokrig.thisWeek")}</p>
      <h1 className="text-center font-black font-wide uppercase text-[clamp(2rem,9vw,4rem)] leading-[0.9] mt-2">
        {a.name} <span className="text-korall-dyp misprint-blue">{t("challenge.versus")}</span> {b.name}
      </h1>
      <div className="mt-10 grid gap-6 md:grid-cols-2">
        {side(a, sa, "bg-syre")}
        {side(b, sb, "bg-rosa")}
      </div>
      <div className="mt-10 flex justify-center">
        <ShareButton kind="nabokrig" url={`/nabokrigen/${duel}?ref=nk:${duel}`} text={t("nabokrig.challengeKommune", { a: a.name, b: b.name })} label={t("nabokrig.duelShare")} variant="hot" />
      </div>
      <p className="mt-8 text-center text-sm text-blekk-2 max-w-xl mx-auto">{t("nabokrig.modelText")}</p>
      <p className="mt-6 text-center">
        <Link href="/nabokrigen" className="kicker underline underline-offset-4">
          {t("nabokrig.leaderboard")}
        </Link>
      </p>
    </div>
  );
}
