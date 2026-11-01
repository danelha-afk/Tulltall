import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { playRound } from "./helpers";

test.describe("spillet", () => {
  test("forsiden kan startes med ett trykk og har ingen alvorlige tilgjengelighetsfeil", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("button", { name: /^Start/ })).toBeVisible();
    const axe = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze();
    const serious = axe.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
    expect(serious, JSON.stringify(serious.map((v) => [v.id, v.nodes.map((n) => n.target)]), null, 2)).toEqual([]);
  });

  test("hele runden, venneduell og sammenligning", async ({ page, browser }) => {
    await page.goto("/");
    await page.getByRole("button", { name: /^Start/ }).click();
    await expect(page).toHaveURL(/\/spill$/);
    await expect(page.getByText(/^1 av 10$/)).toBeVisible();

    const axe = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();
    expect(axe.violations.filter((v) => v.impact === "critical")).toEqual([]);

    await playRound(page);
    await expect(page.getByText(/av 10 riktige/).first()).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole("heading", { name: "Utfordre en venn" })).toBeVisible();

    // Lag utfordring
    await page.getByPlaceholder("f.eks. Kari").fill("Testkari");
    await page.getByRole("button", { name: "Lag lenke" }).click();
    const link = await page.locator("text=/\\/u\\/[a-z0-9]{8}/").first().textContent();
    expect(link).toMatch(/\/u\/[a-z0-9]{8}/);
    const path = new URL(link!.trim()).pathname;

    // Venn åpner lenken i en ny nettleser
    const friendCtx = await browser.newContext();
    const friend = await friendCtx.newPage();
    await friend.goto(path);
    await expect(friend.getByRole("heading", { name: /Testkari utfordrer deg/ })).toBeVisible();
    await friend.getByPlaceholder("f.eks. Kari").fill("Ola");
    await friend.getByRole("button", { name: /Ta utfordringen/ }).click();
    await expect(friend).toHaveURL(/\/spill\?u=/);
    await playRound(friend);
    await expect(friend.getByText(/Du vant!|vant denne gangen|Uavgjort!/)).toBeVisible({ timeout: 15_000 });
    await friendCtx.close();

    // Tilbake på forsiden vises resultatet, ikke en ny runde
    await page.goto("/");
    await expect(page.getByRole("button", { name: /Se resultatet ditt/ })).toBeVisible();
  });

  test("enkeltspørsmål kan deles og spilles", async ({ page }) => {
    await page.goto("/s/antall-kommuner");
    await expect(page.getByRole("heading", { name: "Hvor mange kommuner har Norge?" })).toBeVisible();
    // Svaralternativer: Svar er avslått til man har valgt ett.
    await expect(page.getByRole("button", { name: "Svar", exact: true })).toHaveCount(0);
    await page.getByTestId("estimate-option").first().click();
    await page.getByRole("button", { name: "Svar", exact: true }).click();
    await expect(page.getByText("357 kommuner – og 15 fylker.")).toBeVisible({ timeout: 15_000 });
    await page.getByRole("button", { name: /Se resultatet/ }).click();
    await expect(page.getByRole("link", { name: /Spill dagens runde/ })).toBeVisible();
  });

  test("PWA: manifest og service worker serveres", async ({ request }) => {
    const m = await request.get("/manifest.webmanifest");
    expect(m.ok()).toBe(true);
    const json = await m.json();
    expect(json.display).toBe("standalone");
    expect(json.icons.some((i: { purpose?: string }) => i.purpose === "maskable")).toBe(true);
    const sw = await request.get("/sw.js");
    expect(sw.ok()).toBe(true);
    expect(sw.headers()["cache-control"]).toContain("no-cache");
  });
});

test.describe("Nabokrigen", () => {
  test("velg kommune, spill og få poeng for kommunen", async ({ page }) => {
    await page.goto("/nabokrigen");
    await page.getByLabel("Søk etter kommune").fill("Bergen");
    await page.getByRole("option", { name: /Bergen/ }).first().click();
    await page.getByText("Jeg bor her").click();
    await page.getByRole("button", { name: /Spill for Bergen/ }).click();
    await expect(page).toHaveURL(/\/spill/);
    await playRound(page);
    await expect(page.getByText(/teller for Bergen i Nabokrigen/)).toBeVisible({ timeout: 15_000 });
    await page.goto("/kommune/bergen");
    await expect(page.getByRole("heading", { name: "Bergen" })).toBeVisible();
  });
});

test.describe("API-sikkerhet", () => {
  test("avviser ugyldige og falske svar", async ({ request }) => {
    const start = await request.post("/api/sessions", { data: {} });
    expect(start.ok()).toBe(true);
    const s = await start.json();
    const bad = await request.post(`/api/sessions/${s.sessionId}/answer`, { data: { token: "falsk", questionId: s.questions[0].id, index: 0, answer: { format: "truefalse", value: true } } });
    expect(bad.status()).toBe(403);
    const order = await request.post(`/api/sessions/${s.sessionId}/answer`, { data: { token: s.token, questionId: s.questions[3].id, index: 3, answer: { format: "truefalse", value: true } } });
    expect(order.status()).toBe(409);
    const cron = await request.get("/api/cron/daily");
    expect(cron.status()).toBe(401);
  });

  test("admin krever innlogging", async ({ page }) => {
    await page.goto("/admin");
    await expect(page).toHaveURL(/\/admin\/login/);
    await page.getByLabel("Passord").fill("feil-passord-123");
    await page.getByRole("button", { name: "Logg inn" }).click();
    await expect(page.getByText(/Feil passord/)).toBeVisible();
  });
});
