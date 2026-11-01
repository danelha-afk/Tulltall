"use client";
import Link from "next/link";
import { motion, useReducedMotion } from "motion/react";
import { useEffect, useMemo, useState } from "react";
import { t, formatNumber } from "@/lib/i18n";
import { api, type StartResponse } from "@/lib/client/api";
import { computeStreak, personalBest, store } from "@/lib/client/storage";
import { track } from "@/lib/client/track";
import { shareUrl, prettyUrl } from "@/lib/client/links";
import type { FinishResult } from "@/lib/play/service";
import { localDate, msUntilNextRound } from "@/lib/game/dates";
import { Ticket, PunchHoles } from "@/components/ui/Ticket";
import { Stamp } from "@/components/ui/Stamp";
import { AdSlot } from "@/components/site/AdSlot";
import { ShareButton, copyText } from "./ShareButton";
import { PushOptIn } from "./PushOptIn";
import { ProfileCard } from "./ProfileCard";
import type { ReviewItem } from "./GamePlayer";

/** Resultatet: tittel, hull og «7 av 10 riktige» – og én tydelig vei videre: utfordre en venn. */
export function ResultView({ session, result, review, single }: { session: StartResponse; result: FinishResult; review: ReviewItem[]; single: boolean }) {
  const reduced = useReducedMotion();
  const s = result.summary;
  const title = t(`result.titles.${result.titleKey}` as "result.titles.5");
  const pattern = result.perQuestion.map((p) => p.hit);
  const [history] = useState(() => store.getHistory());
  const best = personalBest(history, session.game.id);
  const isRecord = session.game.kind === "daily" && best !== null && s.score > best;
  const streak = computeStreak(history, localDate());
  const holes = pattern.map((h) => (h ? "●" : "○")).join("");

  return (
    <div className="mx-auto max-w-xl px-4 pt-8 pb-16">
      <motion.div initial={reduced ? false : { y: 50, rotate: -3, opacity: 0 }} animate={{ y: 0, rotate: -1, opacity: 1 }} transition={{ type: "spring", stiffness: 140, damping: 16 }}>
        <Ticket tone={s.hits / Math.max(1, s.total) >= 0.7 ? "syre" : "papir"}>
          <h1 className="font-black font-semi-condensed uppercase text-[clamp(2rem,9vw,3.2rem)] leading-[0.95] misprint text-balance">{title}</h1>
          <div className="mt-6">
            <PunchHoles pattern={pattern} size={26} />
          </div>
          <p className="mt-4 font-extrabold text-[1.7rem] leading-tight">{t("result.hitsOf", { hits: s.hits, total: s.total })}</p>
          <p className="mt-1 text-lg text-blekk-2">
            {formatNumber(s.score)} {t("result.scoreLabel")}
            {session.game.kind === "daily" && streak > 1 ? ` · 🔥 ${t.plural("home.streak", streak)}` : ""}
          </p>
          {isRecord ? (
            <p className="mt-4 text-lg">
              <Stamp color="korall" rotate={-4}>{t("result.personalBest")}</Stamp>
            </p>
          ) : null}
          {session.game.kind === "daily" && result.comparison.beatenPercent !== null ? (
            <p className="mt-3 serif-soft">{t("result.comparison", { percent: result.comparison.beatenPercent, n: formatNumber(result.comparison.n) })}</p>
          ) : null}
        </Ticket>
      </motion.div>

      {session.game.kind === "daily" ? <ProfileCard playerId={session.playerId} /> : null}

      {result.kommune?.counted ? <p className="mt-6 text-center font-bold">{t("result.representing", { kommune: result.kommune.name })}</p> : null}

      {result.challenge ? <HeadToHead result={result} /> : null}

      {!single ? <ChallengeBox session={session} holes={holes} title={title} hits={s.hits} total={s.total} /> : null}

      {single ? (
        <div className="mt-8 text-center">
          <Link href="/spill" className="btn btn-hot text-xl !min-h-14">
            {t("single.dailyCta")} →
          </Link>
        </div>
      ) : null}

      {session.game.kind === "daily" ? <NextRound /> : null}

      {review.length ? (
        <details className="mt-10 group">
          <summary className="cursor-pointer list-none text-center font-bold underline underline-offset-4 text-lg">{t("result.learned")}</summary>
          <ol className="mt-4 grid gap-3">
            {review.map((r, i) => (
              <li key={r.reveal.questionId} className="flex gap-3 items-start rounded-xl border-2 border-blekk bg-papir p-3">
                <span className={`mt-0.5 shrink-0 w-8 h-8 rounded-full border-2 border-blekk grid place-items-center font-black ${r.hit ? "bg-blekk text-papir" : "bg-papir-3"}`}>
                  {i + 1}
                </span>
                <div className="min-w-0">
                  <p className="font-bold leading-snug">{r.reveal.reveal.headline}</p>
                  <p className="text-blekk-2 mt-0.5">{r.prompt}</p>
                </div>
              </li>
            ))}
          </ol>
        </details>
      ) : null}

      <PushOptIn />
      <AdSlot placement="result" />

      <div className="mt-10 text-center">
        <Link href="/" className="font-bold underline underline-offset-4">
          {t("result.playAgain")}
        </Link>
      </div>
    </div>
  );
}

function HeadToHead({ result }: { result: FinishResult }) {
  const ch = result.challenge!;
  const name = ch.creator.nickname ?? t("challenge.anonymous");
  const you = result.summary;
  const outcome = you.score > ch.creator.score ? t("challenge.youWin") : you.score < ch.creator.score ? t("challenge.theyWin", { name }) : t("challenge.tie");
  return (
    <section className="mt-8 rounded-2xl border-[2.5px] border-blekk bg-kobolt text-papir p-5 shadow-[5px_5px_0_var(--color-blekk)]">
      <h2 className="font-black font-wide uppercase text-2xl">{outcome}</h2>
      {ch.headToHead ? (
        <div className="mt-4 grid gap-3">
          <Row label={t("challenge.you")} pattern={ch.headToHead.you} hits={you.hits} />
          <Row label={name} pattern={ch.headToHead.creator} hits={ch.creator.hits} />
        </div>
      ) : null}
    </section>
  );
}

function Row({ label, pattern, hits }: { label: string; pattern: boolean[]; hits: number }) {
  return (
    <div className="flex items-center gap-3 flex-wrap">
      <span className="w-20 font-black uppercase truncate">{label}</span>
      <div className="bg-papir rounded-full px-2 py-1">
        <PunchHoles pattern={pattern} size={14} />
      </div>
      <span className="font-black tabular ml-auto">
        {hits}/{pattern.length}
      </span>
    </div>
  );
}

function ChallengeBox({ session, holes, title, hits, total }: { session: StartResponse; holes: string; title: string; hits: number; total: number }) {
  const [nickname, setNickname] = useState(() => store.getNickname());
  const [link, setLink] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const create = async () => {
    setBusy(true);
    try {
      store.setNickname(nickname);
      const res = await api.challenge({ sessionId: session.sessionId, token: session.token, nickname: nickname || null });
      setLink(shareUrl(`/u/${res.code}`));
      track("challenge_create", {}, { sessionId: session.sessionId });
    } finally {
      setBusy(false);
    }
  };
  const shareText = nickname ? t("result.shareTextChallenge", { name: nickname, hits, total }) : t("result.shareText", { title, hits, total });
  return (
    <section className="mt-8 rounded-2xl border-[2.5px] border-blekk bg-korall p-5 shadow-[5px_5px_0_var(--color-blekk)]">
      <h2 className="font-black font-wide uppercase text-[1.8rem] leading-none">{t("result.challengeTitle")}</h2>
      <p className="mt-2 text-lg">{t("result.challengeText")}</p>
      {link ? (
        <div className="mt-4 grid gap-3">
          <ShareButton kind="challenge" url={link} text={`${shareText}\n${holes}`} label={t("result.share")} variant="primary" sessionId={session.sessionId} />
          <button
            type="button"
            className="btn btn-ghost"
            onClick={async () => {
              if (await copyText(`${shareText}\n${holes}\n${link}`)) {
                setCopied(true);
                track("share_success", { kind: "challenge", via: "copy" }, { sessionId: session.sessionId });
                setTimeout(() => setCopied(false), 2000);
              }
            }}
          >
            {copied ? t("result.copied") : t("result.copyLink")}
          </button>
          <p data-testid="challenge-link" className="text-base break-all font-mono bg-papir/70 rounded-lg px-3 py-2">{prettyUrl(link)}</p>
        </div>
      ) : (
        <form
          className="mt-4 grid gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            void create();
          }}
        >
          <label className="grid gap-1">
            <span className="font-semibold">{t("result.nicknameLabel")}</span>
            <input
              value={nickname}
              maxLength={24}
              onChange={(e) => setNickname(e.target.value)}
              placeholder={t("result.nicknamePlaceholder")}
              className="h-14 rounded-full border-[2.5px] border-blekk bg-papir px-5 text-lg font-bold"
            />
          </label>
          <button type="submit" className="btn btn-primary text-xl !min-h-14" disabled={busy}>
            {t("result.challengeCta")}
          </button>
        </form>
      )}
    </section>
  );
}

function NextRound() {
  const [ms, setMs] = useState<number | null>(null);
  useEffect(() => {
    const tick = () => setMs(msUntilNextRound());
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);
  const text = useMemo(() => {
    if (ms === null) return "--:--:--";
    const s = Math.floor(ms / 1000);
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${pad(Math.floor(s / 3600))}:${pad(Math.floor((s % 3600) / 60))}:${pad(s % 60)}`;
  }, [ms]);
  return (
    <div className="mt-10 text-center">
      <p className="font-bold text-lg">{t("result.nextRound")}</p>
      <p className="font-black font-condensed text-6xl tabular tracking-tight mt-1" aria-live="off">
        {text}
      </p>
    </div>
  );
}
