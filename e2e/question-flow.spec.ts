import { expect, test } from "@playwright/test";

import {
  cleanupRooms,
  createRoom,
  joinPlayer,
  mobileContext,
  patchRoom,
  readQuestions,
  seedHostSession,
  seedPlayerSession,
} from "./helpers";

/**
 * Koko kysymyskierto: käynnistys, kysymys pelaajan puhelimella, vastaus,
 * oikean vastauksen paljastuminen vasta tulosvaiheessa ja välitulostaulu.
 *
 * Kysymyksen määräaika siirretään testifixturella menneisyyteen, jotta testi
 * ei odota 15–25 sekuntia. Itse siirtymä tapahtuu silti sovelluksen oikeaa
 * polkua pitkin: juontajan selain havaitsee määräajan päättyneen ja kutsuu
 * /reveal-rajapintaa, jonka palvelin hyväksyy vasta määräajan jälkeen.
 */

test.afterEach(async () => {
  await cleanupRooms();
});

test("juontaja käynnistää kysymyksen, pelaaja vastaa ja tulostaulu päivittyy", async ({
  browser,
  page,
  baseURL,
}) => {
  const room = await createRoom(baseURL!);
  const winner = await joinPlayer(baseURL!, room.pin, "Aino");
  const loser = await joinPlayer(baseURL!, room.pin, "Eino");

  await seedHostSession(page.context(), room);
  await page.goto(`/host/${room.roomId}`);
  await expect(page.getByTestId("player-count")).toHaveText("2");

  const question = readQuestions()[0];
  const correctAnswer = question.answers[question.correctAnswerIndex];
  const wrongAnswer = question.answers[(question.correctAnswerIndex + 1) % 4];

  // Juontaja käynnistää pelin.
  await page.getByRole("button", { name: "Aloita peli" }).click();

  // Juontaja näkee kysymyksen ja ajastimen, mutta ei vielä oikeaa vastausta.
  await expect(page.getByRole("heading", { name: question.question })).toBeVisible();
  await expect(page.getByText("Aikaa jäljellä")).toBeVisible();
  await expect(page.getByText(/Oikea vastaus:/)).toHaveCount(0);
  await expect(page.getByTestId("answer-count")).toContainText("0 / 2");

  // Pelaaja näkee kysymyksen puhelimellaan ja neljä suurta painiketta.
  const phone = await mobileContext(browser);
  await seedPlayerSession(phone, winner);
  const playerPage = await phone.newPage();
  await playerPage.goto(`/play/${winner.playerId}`);

  await expect(playerPage.getByRole("heading", { name: question.question })).toBeVisible();
  const answerTiles = playerPage.locator("[data-answer-index]");
  await expect(answerTiles).toHaveCount(4);
  // Oikea vastaus ei saa näkyä ennen tulosvaihetta.
  await expect(playerPage.getByText(/Oikea vastaus/)).toHaveCount(0);

  // Pelaaja vastaa oikein.
  await playerPage.locator(`[data-answer-index="${question.correctAnswerIndex}"]`).click();
  await expect(playerPage.getByText("Vastaus tallennettu!")).toBeVisible();
  await expect(playerPage.getByText(`Valintasi: ${correctAnswer}`)).toBeVisible();

  // Toinen vastaus ei enää muuta valintaa.
  const wrongIndex = (question.correctAnswerIndex + 1) % 4;
  await playerPage.locator(`[data-answer-index="${wrongIndex}"]`).click();
  await expect(playerPage.getByText(`Valintasi: ${correctAnswer}`)).toBeVisible();
  await expect(playerPage.getByText(`Valintasi: ${wrongAnswer}`)).toHaveCount(0);

  // Toinen pelaaja vastaa väärin (suoraan rajapintaa pitkin).
  await fetch(`${baseURL}/api/rooms/${room.roomId}/answer`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-player-token": loser.playerToken },
    body: JSON.stringify({ questionIndex: 0, answerIndex: wrongIndex }),
  });

  await expect(page.getByTestId("answer-count")).toContainText("2 / 2");

  // Määräaika päättyy → juontajan selain siirtää kysymyksen tulosvaiheeseen.
  await patchRoom(room.roomId, { question_ends_at: new Date(Date.now() - 1_000).toISOString() });

  await expect(page.getByText(`Oikea vastaus: ${correctAnswer}`)).toBeVisible({
    timeout: 30_000,
  });

  // Pelaaja näkee oikean vastauksen ja omat pisteensä vasta nyt.
  await expect(playerPage.getByText(`Oikea vastaus: ${correctAnswer}`)).toBeVisible({
    timeout: 30_000,
  });
  await expect(playerPage.getByText(/Oikein! \+\d+/)).toBeVisible();

  // Juontaja näyttää välitulostaulun.
  await page.getByRole("button", { name: "Näytä tilanne" }).click();
  await expect(page.getByRole("heading", { name: "Tilanne" })).toBeVisible();

  const leaderboard = page.locator("ol li");
  await expect(leaderboard).toHaveCount(2);
  await expect(leaderboard.nth(0)).toContainText("Aino");
  await expect(leaderboard.nth(1)).toContainText("Eino");
  // Voittajalla on pisteitä, väärin vastanneella ei.
  await expect(leaderboard.nth(0)).toContainText(/\d{3,}/);
  await expect(leaderboard.nth(1)).toContainText("0");

  // Pelaaja näkee oman sijoituksensa.
  await expect(playerPage.getByText("Sijoituksesi")).toBeVisible({ timeout: 20_000 });
  await expect(playerPage.getByText("Viisi parasta")).toBeVisible();

  // Seuraava kysymys käynnistyy tulostaululta.
  await page.getByRole("button", { name: "Seuraava kysymys" }).click();
  await expect(page.getByText("Kysymys 2 /")).toBeVisible({ timeout: 20_000 });

  await phone.close();
});
