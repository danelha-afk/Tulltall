import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestDb, type Db } from "@/lib/db/client";
import { generateHandle, validateHandle } from "@/lib/profile/names";
import { getProfile, updateProfile } from "@/lib/profile/service";
import { topDaily, topWeekly } from "@/lib/toplist/queries";
import { ensurePlayer, finishSession, sanitizeNickname, startSession, submitAnswer, type PlayContext } from "@/lib/play/service";
import { getQuestionRows } from "@/lib/db/questions";
import { localDate, weekRange } from "@/lib/game/dates";
import type { Answer } from "@/lib/game/scoring";

let db: Db;
let ctx: PlayContext;
beforeAll(async () => {
  db = await createTestDb();
  ctx = { db, secret: "s".repeat(32), minAnswerMs: 0, comparisonMinPlayers: 3, ipHash: "x" };
});
afterAll(async () => db.close());

async function play(playerId: string | null, correct: boolean) {
  const s = await startSession(ctx, { playerId });
  const rows = await getQuestionRows(db, s.questions.map((q) => q.id));
  for (let i = 0; i < rows.length; i++) {
    const p = rows[i].content.payload;
    let answer: Answer;
    if (p.format === "truefalse") answer = { format: "truefalse", value: correct ? p.answer : !p.answer };
    else if (p.format === "estimate") answer = { format: "estimate", value: correct ? p.answer : p.min };
    else if (p.format === "compare") {
      const sorted = [...p.items].sort((a, b) => (p.pick === "highest" ? b.value - a.value : a.value - b.value));
      answer = { format: "compare", itemId: correct ? sorted[0].id : sorted[sorted.length - 1].id };
    } else if (p.format === "rank") {
      const t = [...p.items].sort((a, b) => (p.order === "desc" ? b.value - a.value : a.value - b.value)).map((x) => x.id);
      answer = { format: "rank", order: correct ? t : [...t].reverse() };
    } else if (p.format === "trend") answer = { format: "trend", value: correct ? p.series[p.series.length - 1].value : p.min };
    else answer = { format: "map", optionId: (correct ? p.options.find((o) => o.correct) : p.options.find((o) => !o.correct))!.id };
    await submitAnswer(ctx, { sessionId: s.sessionId, token: s.token, questionId: rows[i].id, index: i, answer });
  }
  await finishSession(ctx, { sessionId: s.sessionId, token: s.token });
  return s.playerId;
}

describe("spillernavn", () => {
  it("genererer pene, stabile navn", () => {
    expect(generateHandle("abc")).toBe(generateHandle("abc"));
    expect(generateHandle("abc")).toMatch(/^[A-ZÆØÅ][a-zæøå]+ [A-ZÆØÅ][a-zæøå]+ \d{2}$/);
    expect(new Set(Array.from({ length: 200 }, (_, i) => generateHandle(String(i)))).size).toBeGreaterThan(150);
    for (let i = 0; i < 300; i++) expect(validateHandle(generateHandle(`s${i}`)).ok).toBe(true);
  });

  it("filtrerer upassende navn og personopplysninger", () => {
    expect(validateHandle("Kari").ok).toBe(true);
    expect(validateHandle("Tur-Ola_7").ok).toBe(true);
    expect(validateHandle("ab")).toEqual({ ok: false, error: "short" });
    expect(validateHandle("x".repeat(21))).toEqual({ ok: false, error: "long" });
    expect(validateHandle("Fa3n deg")).toEqual({ ok: false, error: "blocked" });
    expect(validateHandle("h e l v e t e")).toEqual({ ok: false, error: "blocked" });
    expect(validateHandle("F U C K")).toEqual({ ok: false, error: "blocked" });
    expect(validateHandle("kuk")).toEqual({ ok: false, error: "blocked" });
    expect(validateHandle("Kukkuk")).toEqual({ ok: true, value: "Kukkuk" });
    expect(validateHandle("ola@mail.no")).toEqual({ ok: false, error: "personal" });
    expect(validateHandle("ring 91234567")).toEqual({ ok: false, error: "personal" });
    expect(validateHandle("hei!!")).toEqual({ ok: false, error: "chars" });
    expect(sanitizeNickname("Fuck deg")).toBeNull();
    expect(sanitizeNickname("Kari")).toBe("Kari");
  });
});

describe("profil og topplister", () => {
  it("gir hver spiller et navn med én gang", async () => {
    const id = await ensurePlayer(db, null);
    const p = await getProfile(db, id);
    expect(p?.handle).toMatch(/ \d{2}$/);
    expect(p?.showOnLists).toBe(false);
  });

  it("viser bare spillere som har sagt ja, sortert på poeng", async () => {
    const good = await play(null, true);
    const bad = await play(null, false);
    const hiddenOne = await play(null, true);
    const today = localDate();
    expect(await topDaily(db, today)).toEqual([]);

    await updateProfile(db, good, { showOnLists: true });
    await updateProfile(db, bad, { showOnLists: true });
    await updateProfile(db, hiddenOne, { showOnLists: false });
    const rows = await topDaily(db, today);
    expect(rows.map((r) => r.rank)).toEqual([1, 2]);
    expect(rows[0].score).toBeGreaterThan(rows[1].score);
    expect(rows[0].handle).toBe((await getProfile(db, good))!.handle);
    const hiddenHandle = (await getProfile(db, hiddenOne))!.handle;
    expect(rows.some((r) => r.handle === hiddenHandle)).toBe(false);

    const w = weekRange(today);
    const weekly = await topWeekly(db, w.start, w.end);
    expect(weekly).toHaveLength(2);

    // Plassering gjelder alle som har fullført, også de som ikke vises.
    const mine = (await getProfile(db, hiddenOne))!;
    expect(mine.today?.total).toBe(3);
    expect(mine.today?.rank).toBe(1);

    // Redaksjonen kan skjule en spiller.
    await db.query(`UPDATE players SET hidden_by_admin = true WHERE id = $1`, [good]);
    expect((await topDaily(db, today)).map((r) => r.handle)).not.toContain((await getProfile(db, good))!.handle);
  });

  it("godtar rene egne navn, avviser filtrerte og opptatte, og lager nytt tilfeldig navn", async () => {
    const a = await ensurePlayer(db, null);
    const b = await ensurePlayer(db, null);
    expect(await updateProfile(db, a, { customName: "Tulltroll" })).toEqual({ ok: true });
    expect(await updateProfile(db, b, { customName: "tulltroll" })).toEqual({ ok: false, error: "taken" });
    expect(await updateProfile(db, b, { customName: "Faen i helvete" })).toEqual({ ok: false, error: "blocked" });
    expect((await getProfile(db, a))!.custom).toBe(true);
    await updateProfile(db, a, { customName: null });
    const after = (await getProfile(db, a))!;
    expect(after.custom).toBe(false);
    expect(after.handle).not.toBe("Tulltroll");
  });
});
