import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestDb, type Db } from "@/lib/db/client";
import { dailySeries, experimentResults, formatPerformance, funnel, questionPerformance, recalibratePriorities, retention, revenueAndCosts, topicPerformance } from "@/lib/analytics/dashboard";
import { recordEvents } from "@/lib/analytics/events";
import { startSession, submitAnswer, finishSession } from "@/lib/play/service";
import { getQuestionRows } from "@/lib/db/questions";

let db: Db;
beforeAll(async () => {
  db = await createTestDb();
  const ctx = { db, secret: "s".repeat(32), minAnswerMs: 0, comparisonMinPlayers: 30 };
  const s = await startSession(ctx, { playerId: null, variants: { result_layout: "b" } });
  const rows = await getQuestionRows(db, s.questions.map((q) => q.id));
  for (let i = 0; i < 3; i++) {
    const p = rows[i].content.payload;
    const answer = p.format === "truefalse" ? { format: "truefalse", value: true } : p.format === "estimate" ? { format: "estimate", value: p.min } : p.format === "compare" ? { format: "compare", itemId: p.items[0].id } : p.format === "rank" ? { format: "rank", order: p.items.map((x) => x.id) } : p.format === "trend" ? { format: "trend", value: p.min } : { format: "map", optionId: p.options[0].id };
    await submitAnswer(ctx, { sessionId: s.sessionId, token: s.token, questionId: rows[i].id, index: i, answer });
  }
  await recordEvents(db, [{ name: "page_view", path: "/" }, { name: "share_click", props: { kind: "result" }, variants: { result_layout: "b" } }], null);
  void finishSession;
});
afterAll(async () => db.close());

describe("analysepanelets spørringer", () => {
  it("kjører alle spørringer uten feil mot Postgres-skjemaet", async () => {
    const f = await funnel(db, 30);
    expect(f.sessionsStarted).toBe(1);
    expect(f.pageViews).toBe(1);
    expect((await dailySeries(db, 14)).length).toBe(14);
    expect(await retention(db)).toHaveProperty("cohort");
    expect((await questionPerformance(db, 30)).length).toBe(3);
    expect((await formatPerformance(db, 30)).length).toBeGreaterThan(0);
    expect((await topicPerformance(db, 30)).length).toBeGreaterThan(0);
    const ab = await experimentResults(db, "result_layout", 30);
    expect(ab).toEqual([{ variant: "b", sessions: 1, finished: 0, shares: 1 }]);
    expect((await revenueAndCosts(db)).length).toBe(6);
    expect(await recalibratePriorities(db, 1)).toBeGreaterThan(0);
  });
});
