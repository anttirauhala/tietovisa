import { expect, test } from "@playwright/test";

import {
  cleanupRooms,
  createRoom,
  joinPlayer,
  mobileContext,
  patchPlayer,
  patchRoom,
  readQuestions,
  seedHostSession,
  seedPlayerSession,
} from "./helpers";

/**
 * Pelin päättäminen: viimeisen kysymyksen jälkeen tulostaululta siirrytään
 * finished-tilaan, voittaja korostetaan ja pelaaja näkee lopullisen
 * sijoituksensa.
 *
 * Testi asettaa huoneen suoraan viimeiseen kysymykseen ja tulostauluvaiheeseen
 * (testifixture), jotta koko 32 kysymyksen peliä ei tarvitse pelata läpi.
 */

test.afterEach(async () => {
  await cleanupRooms();
});

test("viimeisen kysymyksen jälkeen peli päättyy ja voittaja näytetään", async ({
  browser,
  page,
  baseURL,
}) => {
  const room = await createRoom(baseURL!);
  const winner = await joinPlayer(baseURL!, room.pin, "Aino");
  const second = await joinPlayer(baseURL!, room.pin, "Eino");

  const totalQuestions = readQuestions().length;

  // Testifixture: ollaan viimeisen kysymyksen jälkeisessä tulostauluvaiheessa.
  await patchPlayer(winner.playerId, { score: 1_850, correct_count: 3 });
  await patchPlayer(second.playerId, { score: 420, correct_count: 1 });
  await patchRoom(room.roomId, {
    status: "leaderboard",
    current_question_index: totalQuestions - 1,
    question_started_at: null,
    question_ends_at: null,
  });

  await seedHostSession(page.context(), room);
  await page.goto(`/host/${room.roomId}`);

  // Tulostaulu näkyy ja viimeisen kysymyksen kohdalla tarjotaan pelin päättämistä.
  await expect(page.getByRole("heading", { name: "Tilanne" })).toBeVisible();
  const finishButton = page.getByRole("button", { name: "Näytä lopullinen tulostaulu" });
  await expect(finishButton).toBeVisible();
  await finishButton.click();

  // Lopullinen näkymä: voittaja, konfetti ja koko tulostaulu.
  await expect(page.getByText("Peli päättynyt")).toBeVisible({ timeout: 20_000 });
  await expect(page.getByRole("heading", { name: "Voittaja: Aino" })).toBeVisible();
  await expect(page.getByText("1 850 pistettä")).toBeVisible();
  await expect(page.locator(".confetti-piece").first()).toBeVisible();

  const finalList = page.locator("ol li");
  await expect(finalList).toHaveCount(2);
  await expect(finalList.nth(0)).toContainText("Aino");
  await expect(finalList.nth(1)).toContainText("Eino");

  // Pelaaja näkee lopullisen sijoituksensa ja pistemääränsä.
  const phone = await mobileContext(browser);
  await seedPlayerSession(phone, winner);
  const playerPage = await phone.newPage();
  await playerPage.goto(`/play/${winner.playerId}`);

  await expect(playerPage.getByText("Lopullinen sijoitus")).toBeVisible({ timeout: 20_000 });
  await expect(playerPage.getByText("1.", { exact: true })).toBeVisible();
  await expect(playerPage.getByText("1 850 pistettä")).toBeVisible();
  await expect(playerPage.getByText(`3 oikeaa vastausta / ${totalQuestions} kysymystä`)).toBeVisible();

  // Häviäjä ei ole ykkönen eikä saa konfettia.
  const secondPhone = await mobileContext(browser);
  await seedPlayerSession(secondPhone, second);
  const secondPage = await secondPhone.newPage();
  await secondPage.goto(`/play/${second.playerId}`);

  await expect(secondPage.getByText("Lopullinen sijoitus")).toBeVisible({ timeout: 20_000 });
  await expect(secondPage.getByText("2.", { exact: true })).toBeVisible();
  await expect(secondPage.locator(".confetti-piece")).toHaveCount(0);

  await phone.close();
  await secondPhone.close();
});
