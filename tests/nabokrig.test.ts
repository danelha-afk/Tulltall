import { describe, expect, it } from "vitest";
import { computeWeek, DEFAULT_PARAMS } from "@/lib/nabokrig/model";

const rep = (n: number, v: number) => Array.from({ length: n }, () => v);

describe("Nabokrigens poengmodell", () => {
  it("lar ikke den største kommunen vinne bare på størrelse", () => {
    const res = computeWeek([
      { nr: "stor", population: 700_000, players: 900, scores: rep(2700, 600) },
      { nr: "liten-flink", population: 5_000, players: 20, scores: rep(60, 720) },
    ]);
    expect(res[0].nr).toBe("liten-flink");
  });

  it("lar ikke én heldig spiller vinne alene", () => {
    const res = computeWeek([
      { nr: "heldig", population: 800, players: 1, scores: [1000] },
      { nr: "normal", population: 50_000, players: 100, scores: rep(300, 650) },
    ]);
    const heldig = res.find((r) => r.nr === "heldig")!;
    expect(heldig.ranked).toBe(false);
    expect(heldig.rank).toBeNull();
    // Krymping trekker snittet kraftig mot landssnittet
    expect(heldig.shrunkMean).toBeLessThan(700);
  });

  it("gir ikke ekstrem deltakelse forrang foran bedre kunnskap", () => {
    const res = computeWeek([
      { nr: "ivrig", population: 5_000, players: 100, scores: rep(300, 560) },
      { nr: "flink", population: 300_000, players: 300, scores: rep(900, 700) },
    ]);
    expect(res[0].nr).toBe("flink");
  });

  it("belønner engasjement når kunnskapen er lik", () => {
    const res = computeWeek([
      { nr: "lav", population: 100_000, players: 20, scores: rep(60, 650) },
      { nr: "hoy", population: 100_000, players: 400, scores: rep(1200, 650) },
    ]);
    expect(res[0].nr).toBe("hoy");
  });

  it("holder poengene innenfor 0–100 og respekterer minsteterskel", () => {
    const res = computeWeek(
      [
        { nr: "a", population: 1000, players: 3, scores: rep(3, 1000) },
        { nr: "b", population: 1000, players: 6, scores: rep(6, 0) },
      ],
      { ...DEFAULT_PARAMS, minPlayers: 5 },
    );
    for (const r of res) {
      expect(r.points).toBeGreaterThanOrEqual(0);
      expect(r.points).toBeLessThanOrEqual(100);
    }
    expect(res.find((r) => r.nr === "a")!.ranked).toBe(false);
    expect(res.find((r) => r.nr === "b")!.rank).toBe(1);
  });
});
