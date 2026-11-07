import { describe, expect, it } from "vitest";

import {
  FINISHED_POLL_INTERVAL_MS,
  HIDDEN_POLL_INTERVAL_MS,
  PLAYER_DEADLINE_FAST_WINDOW_MS,
  PLAYER_QUESTION_QUIET_MAX_MS,
  nextPollDelayMs,
  type PollingState,
} from "./polling";

const HOST_INTERVAL = 900;
const PLAYER_INTERVAL = 1100;

/** Kiinteä "nyt" kaikille testeille, jotta määräaika voidaan ilmaista suoraan. */
const NOW = 1_700_000_000_000;

/** Oletukset: näkyvä välilehti, kysymysvaihe, pelaaja, ei määräaikaa. */
function poll(overrides: Partial<PollingState> = {}): number {
  return nextPollDelayMs({
    hidden: false,
    status: "question",
    intervalMs: PLAYER_INTERVAL,
    role: "player",
    questionEndsAtMs: null,
    clockOffsetMs: 0,
    nowMs: NOW,
    ...overrides,
  });
}

describe("kyselyvälin valinta", () => {
  it("käyttää roolikohtaista väliä, kun välilehti on näkyvissä", () => {
    expect(poll({ intervalMs: HOST_INTERVAL, role: "host" })).toBe(HOST_INTERVAL);
    expect(poll({ status: "lobby" })).toBe(PLAYER_INTERVAL);
  });

  it("hidastaa kyselyä piilotetussa välilehdessä mutta ei pysäytä sitä", () => {
    const hostDelay = poll({ hidden: true, status: "lobby", intervalMs: HOST_INTERVAL });
    const playerDelay = poll({ hidden: true });

    expect(hostDelay).toBe(HIDDEN_POLL_INTERVAL_MS);
    expect(playerDelay).toBe(HIDDEN_POLL_INTERVAL_MS);
    // Piilotettu välilehti ei koskaan lakkaa kysymästä: viive on aina äärellinen.
    expect(Number.isFinite(hostDelay)).toBe(true);
    expect(hostDelay).toBeGreaterThan(0);
  });

  it("hidastaa kyselyä eniten, kun peli on päättynyt", () => {
    expect(poll({ status: "finished", intervalMs: HOST_INTERVAL })).toBe(FINISHED_POLL_INTERVAL_MS);
    // Päättynyt peli voittaa myös piilotetun välilehden säännön (suurempi viive).
    expect(poll({ hidden: true, status: "finished", intervalMs: HOST_INTERVAL })).toBe(
      FINISHED_POLL_INTERVAL_MS,
    );
  });

  it("ei koskaan lyhennä väliä alle pyydetyn", () => {
    const longInterval = 8000;

    expect(poll({ intervalMs: longInterval })).toBe(longInterval);
    expect(poll({ status: "lobby", intervalMs: longInterval })).toBe(longInterval);
    expect(poll({ hidden: true, status: "lobby", intervalMs: longInterval })).toBe(longInterval);
    expect(poll({ status: "finished", intervalMs: longInterval })).toBe(longInterval);
  });

  it("käsittelee tuntemattoman tilan normaalina kyselynä", () => {
    expect(poll({ intervalMs: HOST_INTERVAL, role: "host", status: null })).toBe(HOST_INTERVAL);
    expect(poll({ intervalMs: HOST_INTERVAL, role: "host", status: "tuntematon" })).toBe(
      HOST_INTERVAL,
    );
  });
});

describe("pelaajan kysymysvaiheen hiljainen ikkuna", () => {
  it("hidastaa kyselyn turvakattoon, kun kysymystä on reilusti jäljellä", () => {
    // 14 s jäljellä: ei kysellä sekunnin välein, mutta ei yli turvakaton.
    expect(poll({ questionEndsAtMs: NOW + 14_000 })).toBe(PLAYER_QUESTION_QUIET_MAX_MS);
    expect(poll({ questionEndsAtMs: NOW + 2_500 })).toBe(2_500);
  });

  it("palauttaa normaalin tahdin, kun määräaika on käsillä", () => {
    expect(poll({ questionEndsAtMs: NOW + PLAYER_DEADLINE_FAST_WINDOW_MS })).toBe(PLAYER_INTERVAL);
    // Määräaika on jo ylittynyt: tulosvaihe pitää hakea heti.
    expect(poll({ questionEndsAtMs: NOW - 5_000 })).toBe(PLAYER_INTERVAL);
  });

  it("ei hidasta, kun määräaikaa ei tiedetä", () => {
    expect(poll({ questionEndsAtMs: null })).toBe(PLAYER_INTERVAL);
    expect(poll({ questionEndsAtMs: Number.NaN })).toBe(PLAYER_INTERVAL);
  });

  it("ei hidasta muissa vaiheissa eikä juontajalla", () => {
    for (const status of ["lobby", "question_result", "leaderboard", "finished"]) {
      expect(poll({ status, questionEndsAtMs: NOW + 14_000 })).toBe(
        status === "finished" ? FINISHED_POLL_INTERVAL_MS : PLAYER_INTERVAL,
      );
    }

    // Juontaja näyttää vastausmäärän reaaliajassa, joten sitä ei koskaan hiljennetä.
    expect(
      poll({
        role: "host",
        intervalMs: HOST_INTERVAL,
        questionEndsAtMs: NOW + 14_000,
      }),
    ).toBe(HOST_INTERVAL);
  });

  it("huomioi selaimen ja palvelimen kelloeron", () => {
    // Palvelin on 10 s edellä: määräaika NOW + 14 s on 4 s päästä.
    expect(poll({ questionEndsAtMs: NOW + 14_000, clockOffsetMs: 10_000 })).toBe(4_000);
    // Palvelin on 2 s jäljessä: määräaika NOW + 14 s on 16 s päästä.
    expect(poll({ questionEndsAtMs: NOW + 14_000, clockOffsetMs: -2_000 })).toBe(
      PLAYER_QUESTION_QUIET_MAX_MS,
    );
  });

  it("säilyttää piilotetun välilehden ja päättyneen pelin säännöt", () => {
    expect(poll({ hidden: true, questionEndsAtMs: NOW + 14_000 })).toBe(HIDDEN_POLL_INTERVAL_MS);
    expect(poll({ status: "finished", questionEndsAtMs: NOW + 14_000 })).toBe(
      FINISHED_POLL_INTERVAL_MS,
    );
  });
});
