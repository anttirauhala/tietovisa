import { expect, test } from "@playwright/test";

import {
  cleanupRooms,
  createRoom,
  joinPlayer,
  readQuestions,
  seedHostSession,
} from "./helpers";

/**
 * Pelin keskeyttäminen: juontaja voi lopettaa käynnissä olevan kysymyksen
 * kesken määräajan ja päättää pelin ennen viimeistä kysymystä.
 *
 * Testi mittaa, että tulosvaihe saavutetaan selvästi ennen kysymyksen omaa
 * aikarajaa – muuten keskeytys ei olisi aidosti keskeytys.
 */

test.afterEach(async () => {
  await cleanupRooms();
});

test("juontaja voi keskeyttää kysymyksen ja päättää pelin etuajassa", async ({
  page,
  baseURL,
}) => {
  const room = await createRoom(baseURL!);
  const player = await joinPlayer(baseURL!, room.pin, "Aino");

  await seedHostSession(page.context(), room);
  await page.goto(`/host/${room.roomId}`);
  await expect(page.getByTestId("player-count")).toHaveText("1");

  const question = readQuestions()[0];
  // Kysymyksen aikarajan pitää olla riittävän pitkä, jotta keskeytys on merkityksellinen.
  expect(question.timeLimitSeconds).toBeGreaterThanOrEqual(15);

  await page.getByRole("button", { name: "Aloita peli" }).click();
  await expect(page.getByRole("heading", { name: question.question })).toBeVisible();

  // Keskeytetään kysymys heti.
  const interruptedAt = Date.now();
  await page.getByRole("button", { name: "Lopeta kysymys nyt" }).click();

  // Tulosvaihe saavutetaan selvästi ennen kysymyksen omaa määräaikaa.
  await expect(page.getByText(/Oikea vastaus:/)).toBeVisible({ timeout: 15_000 });
  const elapsedMs = Date.now() - interruptedAt;
  expect(elapsedMs).toBeLessThan(question.timeLimitSeconds * 1000 - 5_000);

  // Kysymys on suljettu: myöhästynyt vastaus hylätään palvelimella.
  const lateAnswer = await fetch(`${baseURL}/api/rooms/${room.roomId}/answer`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-player-token": player.playerToken },
    body: JSON.stringify({ questionIndex: 0, answerIndex: 0 }),
  });
  expect(lateAnswer.status).toBe(409);

  // Tulostaulu ja pelin päättäminen kesken sarjan.
  await page.getByRole("button", { name: "Näytä tilanne" }).click();
  await expect(page.getByRole("heading", { name: "Tilanne" })).toBeVisible();

  const finishEarly = page.getByRole("button", { name: "Päätä peli tässä" });
  await expect(finishEarly).toBeVisible();
  await expect(page.getByRole("button", { name: "Seuraava kysymys" })).toBeVisible();

  await finishEarly.click();

  await expect(page.getByText("Peli päättynyt")).toBeVisible({ timeout: 20_000 });
  await expect(page.getByRole("heading", { name: "Voittaja: Aino" })).toBeVisible();
  await expect(page.getByText("Lopullinen tulostaulu")).toBeVisible();
});
