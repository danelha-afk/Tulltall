"use client";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { t } from "@/lib/i18n";
import { api, ApiError, type StartResponse } from "@/lib/client/api";
import { store } from "@/lib/client/storage";
import { setVariants, track } from "@/lib/client/track";
import type { Answer } from "@/lib/game/scoring";
import type { FinishResult } from "@/lib/play/service";
import type { RevealData } from "@/lib/game/public";
import { PunchHoles } from "@/components/ui/Ticket";
import { TrueFalse } from "./TrueFalse";
import { Estimate } from "./Estimate";
import { Compare } from "./Compare";
import { Rank } from "./Rank";
import { Trend } from "./Trend";
import { MapTiles } from "./MapTiles";
import { RevealPanel } from "./RevealPanel";
import { ResultView } from "./ResultView";
import type { RevealState } from "./types";

type Phase = "loading" | "playing" | "finishing" | "result" | "error";

export interface ReviewItem {
  prompt: string;
  hit: boolean;
  points: number;
  reveal: RevealData;
}

export function GamePlayer({ gameId, challengeCode, single = false }: { gameId?: string; challengeCode?: string; single?: boolean }) {
  const reduced = useReducedMotion();
  const [phase, setPhase] = useState<Phase>("loading");
  const [error, setError] = useState<string | null>(null);
  const [session, setSession] = useState<StartResponse | null>(null);
  const [index, setIndex] = useState(0);
  const [busy, setBusy] = useState(false);
  const [reveal, setReveal] = useState<RevealState | null>(null);
  const [pattern, setPattern] = useState<(boolean | null)[]>([]);
  const [result, setResult] = useState<FinishResult | null>(null);
  const [review, setReview] = useState<ReviewItem[]>([]);
  const [offline, setOffline] = useState(false);
  const topRef = useRef<HTMLDivElement>(null);
  const pending = useRef<Answer | null>(null);

  const loadSummary = useCallback(async (s: StartResponse) => {
    const sum = await api.summary(s.sessionId, s.token);
    setResult(sum);
    setReview(sum.reveals.map((r, i) => ({ prompt: r.prompt, hit: sum.perQuestion[i]?.hit ?? false, points: sum.perQuestion[i]?.points ?? 0, reveal: r })));
    setPattern(sum.perQuestion.map((p) => p.hit));
    setPhase("result");
  }, []);

  const start = useCallback(async () => {
    setPhase("loading");
    setError(null);
    try {
      const kommune = store.getKommune();
      const s = await api.start({
        playerId: store.getPlayerId(),
        gameId,
        challengeCode,
        kommuneNr: single ? null : (kommune?.nr ?? null),
        ref: store.getRef(),
        nickname: challengeCode ? store.getNickname() || null : null,
      });
      store.setPlayerId(s.playerId);
      store.setSession(s.game.id, { sessionId: s.sessionId, token: s.token });
      setVariants(s.variants);
      setSession(s);
      const done = s.answers.map((a) => a.hit);
      setPattern([...done, ...Array(s.questions.length - done.length).fill(null)]);
      if (s.finished) {
        await loadSummary(s);
        return;
      }
      setIndex(s.answers.length);
      setPhase("playing");
      track(challengeCode ? "challenge_start" : "game_start", { kind: s.game.kind, resumed: s.answers.length > 0 }, { sessionId: s.sessionId });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("game.errorTitle"));
      setPhase("error");
    }
  }, [gameId, challengeCode, single, loadSummary]);

  useEffect(() => {
    void start();
  }, [start]);

  // Mål avbrutte runder (anonymt) – hjelper oss å finne spørsmål som får folk til å gi opp.
  useEffect(() => {
    if (phase !== "playing" || !session) return;
    const onHide = () => track("game_abandon", { index, q: session.questions[index]?.id ?? null }, { sessionId: session.sessionId });
    window.addEventListener("pagehide", onHide);
    return () => window.removeEventListener("pagehide", onHide);
  }, [phase, session, index]);

  const submit = useCallback(
    async (answer: Answer, attempt = 0): Promise<void> => {
      if (!session) return;
      const q = session.questions[index];
      setBusy(true);
      setOffline(false);
      pending.current = answer;
      try {
        const res = await api.answer(session.sessionId, { token: session.token, questionId: q.id, index, answer });
        pending.current = null;
        setReveal({ data: res.reveal, detail: res.detail, points: res.points, hit: res.hit, retracted: res.retracted, answer });
        setPattern((p) => p.map((v, i) => (i === index ? res.hit : v)));
        setReview((r) => [...r, { prompt: q.prompt, hit: res.hit, points: res.points, reveal: res.reveal }]);
        track("question_answered", { q: q.id, format: q.format, points: res.points, index }, { sessionId: session.sessionId });
      } catch (err) {
        if (err instanceof ApiError && err.code === "too_fast" && attempt < 3) {
          await new Promise((r) => setTimeout(r, 700));
          return submit(answer, attempt + 1);
        }
        if (err instanceof ApiError && err.code === "offline") {
          setOffline(true);
          const retry = () => {
            window.removeEventListener("online", retry);
            if (pending.current) void submit(pending.current);
          };
          window.addEventListener("online", retry);
          return;
        }
        if (err instanceof ApiError && err.code === "out_of_order") {
          await start();
          return;
        }
        setError(err instanceof ApiError ? err.message : t("game.errorTitle"));
      } finally {
        setBusy(false);
      }
    },
    [session, index, start],
  );

  const next = useCallback(async () => {
    if (!session) return;
    if (index + 1 >= session.questions.length) {
      setPhase("finishing");
      try {
        const fin = await api.finish(session.sessionId, session.token);
        setResult(fin);
        setPhase("result");
        track("game_finish", { kind: session.game.kind, score: fin.summary.score, hits: fin.summary.hits }, { sessionId: session.sessionId });
        store.addHistory({
          gameId: session.game.id,
          date: session.game.date,
          kind: session.game.kind,
          score: fin.summary.score,
          maxScore: fin.summary.maxScore,
          hits: fin.summary.hits,
          total: fin.summary.total,
          titleKey: fin.titleKey,
          pattern: fin.perQuestion.map((p) => p.hit),
          at: new Date().toISOString(),
        });
        window.dispatchEvent(new Event("tt:round-finished"));
      } catch (err) {
        setError(err instanceof ApiError ? err.message : t("game.errorTitle"));
        setPhase("error");
      }
    } else {
      setIndex((i) => i + 1);
      setReveal(null);
    }
    requestAnimationFrame(() => topRef.current?.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "start" }));
  }, [session, index, reduced]);

  if (phase === "loading" || phase === "finishing") {
    return (
      <div className="min-h-[60vh] grid place-items-center" aria-busy="true">
        <div className="text-center">
          <div className="inline-flex gap-2" aria-hidden>
            {[0, 1, 2].map((i) => (
              <motion.span
                key={i}
                className="w-4 h-4 rounded-full border-2 border-blekk bg-kobolt"
                animate={reduced ? {} : { y: [0, -10, 0] }}
                transition={{ repeat: Infinity, duration: 0.8, delay: i * 0.12 }}
              />
            ))}
          </div>
          <p className="kicker mt-4">{phase === "finishing" ? t("game.drumroll") : t("game.loading")}</p>
        </div>
      </div>
    );
  }

  if (phase === "error" || !session) {
    return (
      <div className="max-w-md mx-auto my-20 text-center px-4">
        <h2 className="font-black font-wide uppercase text-2xl">{t("game.errorTitle")}</h2>
        <p className="serif-soft mt-3">{error ?? t("home.noGame")}</p>
        <button type="button" className="btn btn-primary mt-6" onClick={() => void start()}>
          {t("game.errorRetry")}
        </button>
      </div>
    );
  }

  if (phase === "result" && result) {
    return <ResultView session={session} result={result} review={review} single={single} />;
  }

  const q = session.questions[index];
  const instruction =
    q.payload.format === "estimate" && q.payload.survey
      ? t("game.instructions.survey")
      : q.payload.format === "compare" && q.payload.pick === "lowest"
        ? t("game.instructions.compareLowest")
        : t(`game.instructions.${q.format}` as "game.instructions.truefalse");
  const common = { onSubmit: (a: Answer) => void submit(a), busy, reveal };
  // Tull eller tall: påstanden ER spørsmålet – vis den bare én gang (på kortet).
  const showPrompt = q.payload.format !== "truefalse";

  return (
    <div ref={topRef} className="mx-auto max-w-2xl px-4 pt-4 pb-16 scroll-mt-16">
      {/* Fremdrift */}
      {session.questions.length > 1 ? (
        <div className="flex items-center justify-between gap-3 mb-5" aria-label={t("game.progressLabel", { n: index, total: session.questions.length })}>
          <PunchHoles pattern={pattern} current={index} size={14} />
          <span className="font-bold tabular text-blekk-2">{t("game.progressShort", { n: index + 1, total: session.questions.length })}</span>
        </div>
      ) : null}

      <AnimatePresence mode="wait">
        <motion.div
          key={q.id}
          initial={reduced ? false : { opacity: 0, x: 40 }}
          animate={{ opacity: 1, x: 0 }}
          exit={reduced ? { opacity: 0 } : { opacity: 0, x: -60 }}
          transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
        >
          {/* Én fast plass for hva du skal gjøre … */}
          <p className="font-black font-wide uppercase text-kobolt text-[1.05rem] tracking-wide mb-2">{instruction}</p>
          {/* … og én stor plass for spørsmålet. */}
          {showPrompt ? (
            <h2 className="font-extrabold text-[clamp(1.6rem,6.8vw,2.4rem)] leading-[1.12] mb-6 text-balance">{q.prompt}</h2>
          ) : null}

          {q.payload.format === "truefalse" ? <TrueFalse q={q as never} {...common} /> : null}
          {q.payload.format === "estimate" ? <Estimate q={q as never} {...common} /> : null}
          {q.payload.format === "compare" ? <Compare q={q as never} {...common} /> : null}
          {q.payload.format === "rank" ? <Rank q={q as never} {...common} /> : null}
          {q.payload.format === "trend" ? <Trend q={q as never} {...common} /> : null}
          {q.payload.format === "map" ? <MapTiles q={q as never} {...common} /> : null}

          {offline ? <p className="mt-4 text-center font-bold bg-korall/30 border-2 border-blekk rounded-xl p-3">{t("game.offline")}</p> : null}
          {error && phase === "playing" ? <p className="mt-4 text-center font-bold text-korall-dyp">{error}</p> : null}

          {reveal ? (
            <RevealPanel
              reveal={reveal}
              questionId={q.id}
              shareText={q.shareText}
              onNext={() => void next()}
              isLast={index + 1 >= session.questions.length}
              sessionId={session.sessionId}
            />
          ) : null}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
