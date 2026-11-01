"use client";
import Link from "next/link";
import { motion, useReducedMotion } from "motion/react";
import { useEffect, useMemo, useState } from "react";
import { t, formatNumber } from "@/lib/i18n";
import { api, type StartResponse } from "@/lib/client/api";
import { computeStreak, personalBest, store } from "@/lib/client/storage";
import { track } from "@/lib/client/track";
import type { FinishResult } from "@/lib/play/service";
import { localDate, msUntilNextRound } from "@/lib/game/dates";
import { Ticket, PunchHoles } from "@/components/ui/Ticket";
import { Odometer } from "@/components/ui/Odometer";
import { Stamp } from "@/components/ui/Stamp";
import { AdSlot } from "@/components/site/AdSlot";
import { ShareButton, copyText } from "./ShareButton";
import { PushOptIn } from "./PushOptIn";
import type { ReviewItem } from "./GamePlayer";

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
  const layout = session.variants?.result_layout ?? "a";

  return (
    <div className="mx-auto max-w-2xl px-4 pt-8 pb-16">
      <motion.div
        initial={reduced ? false : { y: 60, rotate: -4, opacity: 0 }}
        animate={{ y: 0, rotate: -1.2, opacity: 1 }}
        transition={{ type: "spring", stiffness: 140, damping: 16 }}
      >
        <Ticket
          tone={s.hits / Math.max(1, s.total) >= 0.7 ? "syre" : "papir"}
          stub={
            <div className="flex items-center justify-between kicker">
              <span>TULL ELLER TALL?</span>
              <span>{session.game.date ?? ""}</span>
            </div>
          }
        >
          <p className="kicker">
            {session.game.roundNumber ? t("result.ticketTitle", { n: session.game.roundNumber }) : t("single.title")}
          </p>
          {layout === "b" ? (
            <ScoreBlock score={s.score} max={s.maxScore} reduced={Boolean(reduced)} />
          ) : null}
          <h1 className="mt-2 font-black font-semi-condensed uppercase text-[clamp(2rem,9vw,3.4rem)] leading-[0.92] misprint text-balance">{title}</h1>
          <div className="mt-5">
            <PunchHoles pattern={pattern} size={26} />
            <p className="kicker mt-2">{t("result.hitsOf", { hits: s.hits, total: s.total })}</p>
          </div>
          {layout !== "b" ? <ScoreBlock score={s.score} max={s.maxScore} reduced={Boolean(reduced)} /> : null}
          <div className="mt-4 flex flex-wrap gap-2">
            {s.numericAccuracy !== null ? (
              <span className="kicker px-2.5 py-1 rounded-full border-2 border-blekk bg-papir">{t("result.numericAccuracy", { value: s.numericAccuracy })}</span>
            ) : null}
            {session.game.kind === "daily" && streak > 0 ? (
              <span className="kicker px-2.5 py-1 rounded-full border-2 border-blekk bg-papir">🔥 {t.plural("home.streak", streak)}</span>
            ) : null}
          </div>
          {session.game.kind === "daily" ? (
            <p className="mt-4 font-bold">
              {isRecord ? (
                <span className="inline-block text-lg">
                  <Stamp color="korall" rotate={-4}>{t("result.personalBest")}</Stamp>
                </span>
              ) : best !== null ? (
                t("result.personalBestWas", { score: formatNumber(best) })
              ) : null}
            </p>
          ) : null}
          {session.game.kind === "daily" ? (
            <p className="mt-3 text-sm serif-soft">
              {result.comparison.beatenPercent !== null
                ? t("result.comparison", { percent: result.comparison.beatenPercent, n: formatNumber(result.comparison.n) })
                : t("result.comparisonLimited", { n: result.comparison.n })}
            </p>
          ) : null}
        </Ticket>
      </motion.div>

      {result.kommune ? (
        <p className="mt-6 text-center font-bold">
          {result.kommune.counted ? t("result.representing", { kommune: result.kommune.name }) : t("result.representingNotCounted")}
        </p>
      ) : null}

      {result.challenge ? <HeadToHead result={result} /> : null}

      {!single ? <ChallengeBox session={session} holes={holes} title={title} hits={s.hits} total={s.total} /> : null}

      {single ? (
        <div className="mt-8 text-center">
          <p className="serif-soft text-lg">{t("single.after")}</p>
          <Link href="/spill" className="btn btn-hot mt-4 text-lg">
            {t("single.dailyCta")} →
          </Link>
        </div>
      ) : null}

      {session.game.kind === "daily" ? <NextRound /> : null}
      <PushOptIn />
      <AdSlot placement="result" />

      {review.length ? (
        <section className="mt-12">
          <h2 className="font-black font-wide uppercase text-xl mb-4">{t("result.learned")}</h2>
          <ol className="grid gap-3">
            {review.map((r, i) => (
              <li key={r.reveal.questionId} className="flex gap-3 items-start rounded-xl border-2 border-blekk bg-papir p-3">
                <span className={`mt-0.5 shrink-0 w-7 h-7 rounded-full border-2 border-blekk grid place-items-center font-black text-sm ${r.hit ? "bg-blekk text-papir" : "bg-papir-3"}`}>
                  {i + 1}
                </span>
                <div className="min-w-0">
                  <p className="font-bold leading-snug">{r.reveal.reveal.headline}</p>
                  <p className="text-sm text-blekk-2 mt-0.5">{r.prompt}</p>
                  <a href={r.reveal.sources[0]?.url} target="_blank" rel="noopener noreferrer" className="kicker text-kobolt underline underline-offset-2 mt-1 inline-block">
                    {r.reveal.sources[0]?.publisher}
                  </a>
                </div>
              </li>
            ))}
          </ol>
        </section>
      ) : null}

      <div className="mt-10 text-center">
        <Link href="/" className="kicker underline underline-offset-4">
          {t("result.playAgain")}
        </Link>
      </div>
    </div>
  );
}

function ScoreBlock({ score, max, reduced }: { score: number; max: number; reduced: boolean }) {
  return (
    <div className="mt-5 flex items-end gap-2">
      <span className="font-black leading-[0.8] text-[clamp(4rem,22vw,7rem)] tracking-tight">
        <Odometer value={score} duration={reduced ? 0 : 1800} />
      </span>
      <span className="pb-2 font-bold font-wide">
        / {formatNumber(max)} {t("result.scoreLabel")}
      </span>
    </div>
  );
}

function HeadToHead({ result }: { result: FinishResult }) {
  const ch = result.challenge!;
  const name = ch.creator.nickname ?? t("challenge.anonymous");
  const you = result.summary;
  const outcome = you.score > ch.creator.score ? t("challenge.youWin") : you.score < ch.creator.score ? t("challenge.theyWin", { name }) : t("challenge.tie");
  return (
    <section className="mt-10 rounded-2xl border-[2.5px] border-blekk bg-kobolt text-papir p-5 shadow-[5px_5px_0_var(--color-blekk)]">
      <h2 className="font-black font-wide uppercase text-2xl">{outcome}</h2>
      <div className="mt-4 grid gap-3">
        {ch.headToHead ? (
          <>
            <Row label={t("challenge.you")} pattern={ch.headToHead.you} score={you.score} />
            <Row label={name} pattern={ch.headToHead.creator} score={ch.creator.score} />
          </>
        ) : null}
      </div>
      {ch.leaderboard.length > 2 ? (
        <>
          <h3 className="kicker mt-5 mb-2 text-syre">{t("challenge.leaderboard")}</h3>
          <ol className="grid gap-1 font-bold">
            {ch.leaderboard.map((r, i) => (
              <li key={i} className={`flex justify-between rounded-lg px-3 py-1.5 ${r.isYou ? "bg-syre text-blekk" : "bg-papir/10"}`}>
                <span>
                  {i + 1}. {r.isYou ? t("challenge.you") : (r.nickname ?? t("challenge.anonymous"))} {r.isCreator ? "★" : ""}
                </span>
                <span className="tabular">{formatNumber(r.score)}</span>
              </li>
            ))}
          </ol>
        </>
      ) : null}
    </section>
  );
}

function Row({ label, pattern, score }: { label: string; pattern: boolean[]; score: number }) {
  return (
    <div className="flex items-center gap-3 flex-wrap">
      <span className="w-20 font-black uppercase truncate">{label}</span>
      <div className="bg-papir rounded-full px-2 py-1">
        <PunchHoles pattern={pattern} size={14} />
      </div>
      <span className="font-black tabular ml-auto">{formatNumber(score)}</span>
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
      const url = `${window.location.origin}/u/${res.code}?ref=ch:${res.code}`;
      setLink(url);
      track("challenge_create", {}, { sessionId: session.sessionId });
    } finally {
      setBusy(false);
    }
  };
  const shareText = nickname
    ? t("result.shareTextChallenge", { name: nickname, hits, total })
    : t("result.shareText", { title, hits, total });
  return (
    <section className="mt-10 rounded-2xl border-[2.5px] border-blekk bg-korall p-5 shadow-[5px_5px_0_var(--color-blekk)]">
      <h2 className="font-black font-semi-condensed uppercase text-[1.9rem] leading-none">{t("result.challengeTitle")}</h2>
      <p className="serif-soft mt-2">{t("result.challengeText")}</p>
      {link ? (
        <div className="mt-4 grid gap-3">
          <div className="rounded-xl bg-papir border-2 border-blekk px-3 py-2 font-mono text-sm break-all">{link}</div>
          <div className="flex flex-wrap gap-2">
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
          </div>
        </div>
      ) : (
        <form
          className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto] items-end"
          onSubmit={(e) => {
            e.preventDefault();
            void create();
          }}
        >
          <label className="grid gap-1">
            <span className="kicker">{t("result.nicknameLabel")}</span>
            <input
              value={nickname}
              maxLength={24}
              onChange={(e) => setNickname(e.target.value)}
              placeholder={t("result.nicknamePlaceholder")}
              className="h-12 rounded-full border-[2.5px] border-blekk bg-papir px-4 font-bold"
            />
          </label>
          <button type="submit" className="btn btn-primary text-lg" disabled={busy}>
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
      <p className="kicker">{t("result.nextRound")}</p>
      <p className="font-black font-condensed text-6xl tabular tracking-tight mt-1" aria-live="off">
        {text}
      </p>
    </div>
  );
}
