import { test, expect } from "@playwright/test";
import { playRound } from "./helpers";

test("kildene til dagens spørsmål vises på kildelisten etter at man har spilt, ikke før", async ({ page }) => {
  await page.goto("/kilder");
  await expect(page.getByText(/dukker opp her når du har spilt ferdig/)).toBeVisible();
  await expect(page.getByTestId("today-source")).toHaveCount(0);

  await page.goto("/");
  await page.getByRole("button", { name: /^Start/ }).click();
  await playRound(page);

  await page.goto("/kilder");
  await expect(page.getByTestId("today-source").first()).toBeVisible({ timeout: 15_000 });
  expect(await page.getByTestId("today-source").count()).toBeGreaterThanOrEqual(5);
  await expect(page.getByText(/dukker opp her når du har spilt ferdig/)).toHaveCount(0);
});
