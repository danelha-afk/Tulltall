import { test, expect } from "@playwright/test";
import { playRound } from "./helpers";

test("alle som har spilt står på topp 10 med navn, og kan skjule seg", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: /^Start/ }).click();
  await playRound(page);

  const handleEl = page.getByTestId("my-handle");
  await expect(handleEl).toBeVisible({ timeout: 15_000 });
  const handle = ((await handleEl.textContent()) ?? "").trim();
  expect(handle).toMatch(/\S+ \S+ \d{2}/);
  await expect(page.getByText("Du står på listen").first()).toBeVisible();

  // Ingen må trykke noe: navnet står på forsiden i dag og denne uken.
  await page.goto("/");
  await expect(page.getByRole("list", { name: "Topp 10 i dag" }).getByText(handle)).toBeVisible({ timeout: 15_000 });
  await page.getByRole("button", { name: "Uka" }).click();
  await expect(page.getByRole("list", { name: "Topp 10 denne uken" }).getByText(handle)).toBeVisible();

  // Skjul meg: navnet forsvinner fra listen.
  await page.goto("/profil");
  await page.getByRole("checkbox", { name: /Vis meg på topplistene/ }).click(); // oppdateres etter serverkall
  await expect(page.getByRole("checkbox", { name: /Vis meg på topplistene/ })).not.toBeChecked();
  const listed = page.waitForResponse((r) => r.url().includes("/api/toplist?period=day"));
  await page.goto("/");
  await listed;
  await expect(page.getByText("Du er skjult på listen")).toBeVisible();
  await expect(page.getByRole("list", { name: "Topp 10 i dag" }).getByText(handle)).toHaveCount(0);
});

test("profilsiden: filter mot upassende navn, og eget navn kan lagres", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: /^Start/ }).click();
  await playRound(page);
  await page.goto("/profil");
  const input = page.getByLabel("Velg eget navn");
  await input.fill("Fa3n");
  await page.getByRole("button", { name: "Lagre" }).click();
  await expect(page.getByText("Det navnet kan vi ikke bruke")).toBeVisible();
  const unique = `Ola${Date.now() % 100000}`;
  await input.fill(unique);
  await page.getByRole("button", { name: "Lagre" }).click();
  await expect(page.getByTestId("profile-handle")).toHaveText(unique);
});
