import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestDb, type Db } from "@/lib/db/client";
import {
  createChallenge,
  finishSession,
  getChallengeView,
  PlayError,
  startSession,
  submitAnswer,
  type PlayContext,
} from "@/lib/play/service";
import { getQuestionRows } from "@/lib/db/questions";
import { correctCompareId, correctRankOrder } from "@/lib/game/scoring";
import type { Answer } from "@/lib/game/scoring";
import type { Payload } from "@/lib/game/schema";
import { localDate } from "@/lib/game/dates";

let db: Db;
let ctx: PlayContext;

beforeAll(async () => {
  db = await createTestDb();
  ctx = { db, secret: "test-secret-test-secret-test-secret", minAnswerMs: 0, comparisonMinPlayers: 3, ipHash: "ip-a" };
});
afterAll(async () => {
  await db.close();
});

function perfectAnswer(p: Payload): Answer {
  switch (p.format) {
    case "truefalse":
      return { format: "truefalse", value: p.answer };
    case "estimate":
      return { format: "estimate", value: p.answer };
    case "compare":
      return { format: "compare", itemId: correctCompareId(p) };
    case "rank":
      return { format: "rank", order: correctRankOrder(p) };
    case "trend":
      return { format: "trend", value: p.series[p.series.length - 1].value };
    case "map":
      return { format: "map", optionId: p.options.find((o) => o.correct)!.id };
  }
}

function wrongAnswer(p: Payload): Answer {
  switch (p.format) {
    case "truefalse":
      return { format: "truefalse", value: !p.answer };
    case "estimate":
      return { format: "estimate", value: p.answer === p.min ? p.max : p.min };
    case "compare":
      return { format: "compare", itemId: p.items.find((i) => i.id !== correctCompareId(p))!.id };
    case "rank":
      return { format: "rank", order: [...correctRankOrder(p)].reverse() };
    case "trend":
      return { format: "trend", value: p.min };
    case "map":
      return { format: "map", optionId: p.options.find((o) => !o.correct)!.id };
  }
}

async function playThrough(playerId: string | null, mode: "perfect" | "wrong", extra: { challengeCode?: string; kommuneNr?: string } = {}) {
  const start = await startSession(ctx, { playerId, ...extra });
  const rows = await getQuestionRows(db, start.questions.map((q) => q.id));
  for (let i = 0; i < rows.length; i++) {
    const payload = rows[i].content.payload;
    const res = await submitAnswer(ctx, {
      sessionId: start.sessionId,
      token: start.token,
      questionId: rows[i].id,
      index: i,
      answer: mode === "perfect" ? perfectAnswer(payload) : wrongAnswer(payload),
    });
    expect(res.reveal.questionId).toBe(rows[i].id);
  }
  const fin = await finishSession(ctx, { sessionId: start.sessionId, token: start.token });
  return { start, fin };
}

describe("spillflyt", () => {
  it("starter dagens runde med 10 spørsmål uten fasit i klientdata", async () => {
    const s = await startSession(ctx, { playerId: null });
    expect(s.questions).toHaveLength(10);
    expect(s.game.kind).toBe("daily");
    expect(s.game.date).toBe(localDate());
    const json = JSON.stringify(s.questions);
    expect(json).not.toMatch(/"answer"/);
    expect(json).not.toMatch(/"correct"/);
    expect(json).not.toMatch(/"value":\s*\d/); // ingen råverdier for compare/rank
  });

  it("gir alle spillere samme runde samme dag (deterministisk)", async () => {
    const a = await startSession(ctx, { playerId: null });
    const b = await startSession(ctx, { playerId: null });
    expect(a.questions.map((q) => q.id)).toEqual(b.questions.map((q) => q.id));
  });

  it("perfekt runde gir full pott, feil runde gir få poeng", async () => {
    const { fin } = await playThrough(null, "perfect");
    expect(fin.summary.hits).toBe(fin.summary.total);
    expect(fin.summary.score).toBe(fin.summary.maxScore);
    expect(fin.titleKey).toBe("10");
    const bad = await playThrough(null, "wrong");
    expect(bad.fin.summary.hits).toBeLessThan(3);
  });

  it("avviser svar i feil rekkefølge, dobbeltsvar og feil token", async () => {
    const s = await startSession(ctx, { playerId: null });
    const [row] = await getQuestionRows(db, [s.questions[1].id]);
    await expect(
      submitAnswer(ctx, { sessionId: s.sessionId, token: s.token, questionId: row.id, index: 1, answer: perfectAnswer(row.content.payload) }),
    ).rejects.toBeInstanceOf(PlayError);
    const [first] = await getQuestionRows(db, [s.questions[0].id]);
    await expect(
      submitAnswer(ctx, { sessionId: s.sessionId, token: "feil", questionId: first.id, index: 0, answer: perfectAnswer(first.content.payload) }),
    ).rejects.toMatchObject({ code: "forbidden" });
    await submitAnswer(ctx, { sessionId: s.sessionId, token: s.token, questionId: first.id, index: 0, answer: perfectAnswer(first.content.payload) });
    await expect(
      submitAnswer(ctx, { sessionId: s.sessionId, token: s.token, questionId: first.id, index: 0, answer: perfectAnswer(first.content.payload) }),
    ).rejects.toMatchObject({ code: "out_of_order" });
  });

  it("avviser for raske svar", async () => {
    const strict = { ...ctx, minAnswerMs: 60_000 };
    const s = await startSession(strict, { playerId: null });
    const [first] = await getQuestionRows(db, [s.questions[0].id]);
    await expect(
      submitAnswer(strict, { sessionId: s.sessionId, token: s.token, questionId: first.id, index: 0, answer: perfectAnswer(first.content.payload) }),
    ).rejects.toMatchObject({ code: "too_fast" });
  });

  it("gjenopptar samme økt for samme spiller (ingen omspill)", async () => {
    const a = await startSession(ctx, { playerId: null });
    const b = await startSession(ctx, { playerId: a.playerId });
    expect(b.sessionId).toBe(a.sessionId);
  });
});

describe("venneduell", () => {
  it("lager utfordring, mottaker spiller samme spørsmål, og får sammenligning", async () => {
    const creator = await playThrough(null, "perfect");
    const ch = await createChallenge(ctx, { sessionId: creator.start.sessionId, token: creator.start.token, nickname: "Kari <script>" });
    expect(ch.code).toMatch(/^[a-z0-9]{6}$/);
    const view = await getChallengeView(db, ch.code);
    expect(view?.creator.nickname).toBe("Kari script");
    expect(view?.creator.hits).toBe(10);

    const friend = await playThrough(null, "wrong", { challengeCode: ch.code });
    expect(friend.start.questions.map((q) => q.id)).toEqual(creator.start.questions.map((q) => q.id));
    expect(friend.fin.challenge?.headToHead?.creator).toHaveLength(10);
    expect(friend.fin.challenge?.leaderboard.length).toBeGreaterThanOrEqual(2);
    const again = await createChallenge(ctx, { sessionId: creator.start.sessionId, token: creator.start.token });
    expect(again.code).toBe(ch.code);
  });

  it("krever fullført runde for å utfordre", async () => {
    const s = await startSession(ctx, { playerId: null });
    await expect(createChallenge(ctx, { sessionId: s.sessionId, token: s.token })).rejects.toMatchObject({ code: "not_finished" });
  });
});

describe("Nabokrigen-telling", () => {
  it("teller bare første fullførte runde per spiller og dag", async () => {
    const first = await playThrough(null, "perfect", { kommuneNr: "4601" });
    expect(first.fin.kommune?.counted).toBe(true);
    expect(first.fin.kommune?.name).toBe("Bergen");
    // Samme spiller kan ikke spille dagens runde på nytt (gjenopptar fullført økt)
    const again = await startSession(ctx, { playerId: first.start.playerId, kommuneNr: "4601" });
    expect(again.finished).toBe(true);
  });

  it("avviser ukjent kommune", async () => {
    await expect(startSession(ctx, { playerId: null, kommuneNr: "9999" })).rejects.toMatchObject({ code: "bad_request" });
  });

  it("begrenser antall tellende runder per IP-hash", async () => {
    const local = { ...ctx, ipHash: "ip-flood" };
    let counted = 0;
    for (let i = 0; i < 14; i++) {
      const s = await startSession(local, { playerId: null, kommuneNr: "1144" });
      const rows = await getQuestionRows(db, s.questions.map((q) => q.id));
      for (let j = 0; j < rows.length; j++) {
        await submitAnswer(local, { sessionId: s.sessionId, token: s.token, questionId: rows[j].id, index: j, answer: perfectAnswer(rows[j].content.payload) });
      }
      const f = await finishSession(local, { sessionId: s.sessionId, token: s.token });
      if (f.kommune?.counted) counted++;
    }
    expect(counted).toBe(12);
  });
});
