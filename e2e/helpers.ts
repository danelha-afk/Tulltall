import { expect, type Page } from "@playwright/test";

/** Svarer på gjeldende spørsmål uansett format (ikke nødvendigvis riktig). */
export async function answerCurrent(page: Page) {
  const tall = page.getByRole("button", { name: "Stemmer", exact: true });
  const lock = page.getByRole("button", { name: "Svar", exact: true });
  const option = page.getByTestId("estimate-option");
  if (await tall.count()) {
    await tall.first().click();
  } else if (await option.count()) {
    // Tallspørsmål med svaralternativer: velg ett, trykk Svar.
    await option.nth(1).click();
    await expect(lock).toBeEnabled();
    await lock.click();
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
  await expect(page.getByRole("button", { name: /Neste spørsmål|Se resultatet/ })).toBeVisible({ timeout: 15_000 });
}

export async function playRound(page: Page) {
  for (let i = 0; i < 15; i++) {
    // «1 av 10» finnes også i Topp 10 på forsiden, så fremdriften har egen test-id.
    await expect(page.getByTestId("progress")).toHaveText(new RegExp(`^${i + 1} av \\d+$`), { timeout: 15_000 });
    // Vent til forrige spørsmål har animert ut før vi svarer.
    await expect(page.getByRole("button", { name: /Neste spørsmål|Se resultatet/ })).toHaveCount(0, { timeout: 15_000 });
    await answerCurrent(page);
    const finish = page.getByRole("button", { name: /Se resultatet/ });
    if (await finish.count()) {
      await finish.click();
      return;
    }
    await page.getByRole("button", { name: /Neste spørsmål/ }).click();
  }
  throw new Error("Runden ble aldri ferdig");
}
