import { expect, test } from "@playwright/test";

import { cleanupRooms, createRoom, seedHostSession } from "./helpers";

/**
 * Juontajan odotushuone: liittymiskoodi ja QR-koodi (toteutusohjeen
 * hyväksymiskriteeri "Liittymiskoodi ja QR-koodi toimivat").
 *
 * QR-kuvan sisältöä ei dekoodata testissä, mutta testataan sitä vastaava
 * polku: sivulla näkyvä liittymislinkki avataan selaimessa ja varmistetaan,
 * että se esitäyttää liittymislomakkeen PIN-koodin. Lisäksi varmistetaan,
 * että QR-renderöityy riittävän suurena projektorikäyttöön.
 */

test.afterEach(async () => {
  await cleanupRooms();
});

test("juontaja luo pelin ja näkee liittymiskoodin sekä QR-koodin", async ({ page, baseURL }) => {
  const room = await createRoom(baseURL!);
  await seedHostSession(page.context(), room);

  await page.goto(`/host/${room.roomId}`);

  await expect(page.getByRole("heading", { name: "Liity peliin" })).toBeVisible();

  // PIN-koodi näkyy isolla juontajan näytöllä.
  await expect(page.getByText("Liittymiskoodi")).toBeVisible();
  await expect(page.getByText(room.pin, { exact: true })).toBeVisible();

  // QR-koodi renderöityy SVG:nä ja on tarpeeksi suuri projektorilta skannattavaksi.
  const qr = page.locator("svg").filter({ has: page.locator("title") }).first();
  await expect(qr).toBeVisible();
  const box = await qr.boundingBox();
  expect(box).not.toBeNull();
  expect(box!.width).toBeGreaterThanOrEqual(200);
  expect(box!.height).toBeGreaterThanOrEqual(200);

  // Sivulla näkyvä liittymislinkki vastaa QR-koodin sisältöä.
  const joinLink = page.getByText(/\/join\?pin=/);
  await expect(joinLink).toBeVisible();
  const href = (await joinLink.textContent())?.trim() ?? "";
  expect(href).toMatch(new RegExp(`/join\\?pin=${room.pin}$`));

  // Linkin avaaminen esitäyttää PIN-koodin liittymislomakkeeseen.
  await page.goto(href);
  await expect(page.getByLabel("Liittymiskoodi")).toHaveValue(room.pin);
  await expect(page.getByRole("button", { name: "Liity peliin" })).toBeVisible();
});
