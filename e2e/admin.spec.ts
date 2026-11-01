import { test, expect } from "@playwright/test";

test("redaktør kan logge inn, se køen og godkjenne et høyrisiko-spørsmål", async ({ page }) => {
  await page.goto("/admin/login");
  await page.getByLabel("Passord").fill("e2e-admin-passord");
  await page.getByRole("button", { name: "Logg inn" }).click();
  await expect(page.getByText("Spørsmålsbanken")).toBeVisible();

  await page.goto("/admin/ko");
  await expect(page.getByRole("heading", { name: "Godkjenningskø" })).toBeVisible();
  const card = page.locator("section", { hasText: "Hvis både innvandringen og antall anmeldte lovbrudd øker" }).first();
  await expect(card.getByText("Høy risiko")).toBeVisible();
  await card.getByRole("button", { name: "Godkjenn" }).click();
  await expect(page.locator("section", { hasText: "Hvis både innvandringen og antall anmeldte lovbrudd øker" })).toHaveCount(0);

  await page.goto("/admin/sporsmal?q=samtidig");
  await expect(page.locator("li span.kicker", { hasText: "Godkjent" }).first()).toBeVisible();

  const pages: [string, string][] = [
    ["/admin/runder", "Daglige runder"],
    ["/admin/data", "Data og automatisering"],
    ["/admin/analyse", "Analyse"],
    ["/admin/innstillinger", "Innstillinger"],
    ["/admin", "Redaksjonen"],
  ];
  for (const [path, heading] of pages) {
    const res = await page.goto(path);
    expect(res?.status(), path).toBe(200);
    await expect(page.getByText(heading, { exact: true }).first()).toBeVisible();
    await expect(page.getByText("This page couldn’t load")).toHaveCount(0);
  }
});
