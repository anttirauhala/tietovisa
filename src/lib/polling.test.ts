import { describe, expect, it } from "vitest";

import {
  HIDDEN_POLL_INTERVAL_MS,
  PLAYER_DEADLINE_FAST_WINDOW_MS,
  PLAYER_QUESTION_QUIET_MAX_MS,
  POLL_TIMEOUT_MIN_MS,
  nextPollDelayMs,
  pollTimeoutMs,
  type PollingState,
} from "./polling";

const HOST_INTERVAL = 900;
const PLAYER_INTERVAL = 1100;

/** Kiinteä "nyt" kaikille testeille, jotta määräaika voidaan ilmaista suoraan. */
const NOW = 1_700_000_000_000;

/** Oletukset: näkyvä välilehti, kysymysvaihe, pelaaja, ei määräaikaa. */
function poll(overrides: Partial<PollingState> = {}): number | null {
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
    // Piilotettu välilehti ei kesken pelin lakkaa kysymästä: viive on äärellinen.
    expect(Number.isFinite(hostDelay)).toBe(true);
    expect(hostDelay).toBeGreaterThan(0);
  });

  it("lopettaa kyselyn kokonaan, kun peli on päättynyt", () => {
    // Päättynyt peli on terminaalinen: uutta tietoa ei ole eikä tule.
    expect(poll({ status: "finished", intervalMs: HOST_INTERVAL })).toBeNull();
    expect(poll({ status: "finished" })).toBeNull();
    expect(poll({ role: "host", status: "finished" })).toBeNull();
    // Myös piilotettu välilehti lopettaa: tila ei voi enää muuttua.
    expect(poll({ hidden: true, status: "finished" })).toBeNull();
  });

  it("ei koskaan lyhennä väliä alle pyydetyn", () => {
    const longInterval = 8000;

    expect(poll({ intervalMs: longInterval })).toBe(longInterval);
    expect(poll({ status: "lobby", intervalMs: longInterval })).toBe(longInterval);
    expect(poll({ hidden: true, status: "lobby", intervalMs: longInterval })).toBe(longInterval);
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
    for (const status of ["lobby", "question_result", "leaderboard"]) {
      expect(poll({ status, questionEndsAtMs: NOW + 14_000 })).toBe(PLAYER_INTERVAL);
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

  it("säilyttää piilotetun välilehden säännön", () => {
    expect(poll({ hidden: true, questionEndsAtMs: NOW + 14_000 })).toBe(HIDDEN_POLL_INTERVAL_MS);
  });
});

describe("tilakyselyn aikakatkaisu", () => {
  it("antaa hitaalle mutta toimivalle pyynnölle kaksi kyselyväliä aikaa", () => {
    expect(pollTimeoutMs(PLAYER_QUESTION_QUIET_MAX_MS)).toBe(2 * PLAYER_QUESTION_QUIET_MAX_MS);
    expect(pollTimeoutMs(HIDDEN_POLL_INTERVAL_MS)).toBe(2 * HIDDEN_POLL_INTERVAL_MS);
  });

  it("pitää alarajan, jotta kylmäkäynnistys ei katkaise pyyntöä", () => {
    // Normaalitahti on niin tiheä, että kaksinkertainen väli jäisi liian lyhyeksi.
    expect(pollTimeoutMs(PLAYER_INTERVAL)).toBe(POLL_TIMEOUT_MIN_MS);
    expect(pollTimeoutMs(HOST_INTERVAL)).toBe(POLL_TIMEOUT_MIN_MS);
    expect(pollTimeoutMs(0)).toBe(POLL_TIMEOUT_MIN_MS);
  });

  it("on aina pidempi kuin kyselyväli, jotta pyyntö ehtii valmistua", () => {
    for (const delay of [
      HOST_INTERVAL,
      PLAYER_INTERVAL,
      HIDDEN_POLL_INTERVAL_MS,
      PLAYER_QUESTION_QUIET_MAX_MS,
    ]) {
      expect(pollTimeoutMs(delay)).toBeGreaterThan(delay);
    }
  });

  it("kasvaa kyselyvälin mukana, joten hiljainen ikkuna ei katkaise pyyntöä", () => {
    expect(pollTimeoutMs(PLAYER_QUESTION_QUIET_MAX_MS)).toBeGreaterThan(
      pollTimeoutMs(PLAYER_INTERVAL),
    );
  });
});
