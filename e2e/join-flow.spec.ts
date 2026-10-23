import { expect, test } from "@playwright/test";

import {
  cleanupRooms,
  createRoom,
  mobileContext,
  seedHostSession,
} from "./helpers";

/**
 * Pelaajien liittyminen ja juontajan reaaliaikainen pelaajalista.
 * Jokainen pelaaja saa oman selainkontekstin (oma localStorage), joten testi
 * vastaa kahta erillistä puhelinta.
 */

test.afterEach(async () => {
  await cleanupRooms();
});

test("kaksi pelaajaa liittyy PIN-koodilla ja juontaja näkee heidät", async ({
  browser,
  page,
  baseURL,
}) => {
  const room = await createRoom(baseURL!);
  await seedHostSession(page.context(), room);
  await page.goto(`/host/${room.roomId}`);

  await expect(page.getByTestId("player-count")).toHaveText("0");

  // Pelaaja 1: liittyy QR-linkin kautta (PIN esitäytettynä).
  const firstPhone = await mobileContext(browser);
  const firstPage = await firstPhone.newPage();
  await firstPage.goto(`/join?pin=${room.pin}`);
  await expect(firstPage.getByLabel("Liittymiskoodi")).toHaveValue(room.pin);
  await firstPage.getByLabel("Nimimerkki").fill("Joulu-Jussi");
  await firstPage.getByRole("button", { name: "Liity peliin" }).click();

  await expect(firstPage.getByRole("heading", { name: "Odotetaan juontajaa" })).toBeVisible();
  await expect(
    firstPage.getByText(/Olet mukana pelissä nimimerkillä Joulu-Jussi/),
  ).toBeVisible();

  // Pelaaja 2: liittyy syöttämällä koodin käsin.
  const secondPhone = await mobileContext(browser);
  const secondPage = await secondPhone.newPage();
  await secondPage.goto("/join");
  await secondPage.getByLabel("Liittymiskoodi").fill(room.pin);
  await secondPage.getByLabel("Nimimerkki").fill("Pukki");
  await secondPage.getByRole("button", { name: "Liity peliin" }).click();
  await expect(secondPage.getByRole("heading", { name: "Odotetaan juontajaa" })).toBeVisible();

  // Juontaja näkee molemmat pelaajat ja määrän (kyselyväli 900 ms).
  await expect(page.getByTestId("player-count")).toHaveText("2");
  await expect(page.getByText("Joulu-Jussi")).toBeVisible();
  await expect(page.getByText("Pukki")).toBeVisible();
  await expect(page.getByRole("button", { name: "Aloita peli" })).toBeEnabled();

  // Sama nimimerkki eri kirjainkoolla hylätään selkeällä virheellä.
  const thirdPhone = await mobileContext(browser);
  const thirdPage = await thirdPhone.newPage();
  await thirdPage.goto("/join");
  await thirdPage.getByLabel("Liittymiskoodi").fill(room.pin);
  await thirdPage.getByLabel("Nimimerkki").fill("pukki");
  await thirdPage.getByRole("button", { name: "Liity peliin" }).click();
  await expect(thirdPage.getByText("Nimimerkki on jo käytössä tässä pelissä.")).toBeVisible();

  // Virheellinen PIN-koodi kertoo selkeästi, ettei huonetta löytynyt.
  await thirdPage.getByLabel("Liittymiskoodi").fill("000000");
  await thirdPage.getByLabel("Nimimerkki").fill("Hukassa");
  await thirdPage.getByRole("button", { name: "Liity peliin" }).click();
  await expect(thirdPage.getByText("Pelihuonetta ei löytynyt.")).toBeVisible();

  await firstPhone.close();
  await secondPhone.close();
  await thirdPhone.close();
});
