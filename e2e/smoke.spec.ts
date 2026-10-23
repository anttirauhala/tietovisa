import { expect, test } from "@playwright/test";

/**
 * Savutesti: selain käynnistyy ja sovelluksen etusivu renderöityy.
 */
test("etusivu näkyy ja sisältää molemmat aloituspolut", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { level: 1 })).toContainText("Pikkujouluvisa");
  await expect(page.getByRole("link", { name: /Olen juontaja/i })).toBeVisible();
  await expect(page.getByRole("link", { name: /Liity peliin/i })).toBeVisible();
});
