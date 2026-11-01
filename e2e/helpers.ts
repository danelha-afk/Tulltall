import { expect, type Page } from "@playwright/test";

/** Svarer på gjeldende spørsmål uansett format (ikke nødvendigvis riktig). */
export async function answerCurrent(page: Page) {
  const tall = page.getByRole("button", { name: /^(TALL|Det stemmer)/ });
  const lock = page.getByRole("button", { name: "Lås svaret" });
  if (await tall.count()) {
    await tall.first().click();
  } else if (await lock.count()) {
    const slider = page.locator("[role=slider]").first();
    if (await slider.count()) {
      await slider.focus();
      await page.keyboard.press("ArrowRight");
      await page.keyboard.press("ArrowRight");
    }
    await lock.click();
  } else {
    await page.locator("button[aria-pressed]:not([disabled])").first().click();
  }
  await expect(page.getByRole("button", { name: /Neste spørsmål|Se billetten din/ })).toBeVisible({ timeout: 15_000 });
}

export async function playRound(page: Page) {
  for (let i = 0; i < 15; i++) {
    await expect(page.getByText(new RegExp(`^${i + 1}/\\d+$`))).toBeVisible({ timeout: 15_000 });
    // Vent til forrige spørsmål har animert ut før vi svarer.
    await expect(page.getByRole("button", { name: /Neste spørsmål|Se billetten din/ })).toHaveCount(0, { timeout: 15_000 });
    await answerCurrent(page);
    const finish = page.getByRole("button", { name: /Se billetten din/ });
    if (await finish.count()) {
      await finish.click();
      return;
    }
    await page.getByRole("button", { name: /Neste spørsmål/ }).click();
  }
  throw new Error("Runden ble aldri ferdig");
}
