import { describe, expect, it } from "vitest";

import {
  FINISHED_POLL_INTERVAL_MS,
  HIDDEN_POLL_INTERVAL_MS,
  nextPollDelayMs,
} from "./polling";

const HOST_INTERVAL = 900;
const PLAYER_INTERVAL = 1100;

describe("kyselyvälin valinta", () => {
  it("käyttää roolikohtaista väliä, kun välilehti on näkyvissä", () => {
    expect(
      nextPollDelayMs({ hidden: false, status: "question", intervalMs: HOST_INTERVAL }),
    ).toBe(HOST_INTERVAL);
    expect(
      nextPollDelayMs({ hidden: false, status: "lobby", intervalMs: PLAYER_INTERVAL }),
    ).toBe(PLAYER_INTERVAL);
  });

  it("hidastaa kyselyä piilotetussa välilehdessä mutta ei pysäytä sitä", () => {
    const hostDelay = nextPollDelayMs({
      hidden: true,
      status: "lobby",
      intervalMs: HOST_INTERVAL,
    });
    const playerDelay = nextPollDelayMs({
      hidden: true,
      status: "question",
      intervalMs: PLAYER_INTERVAL,
    });

    expect(hostDelay).toBe(HIDDEN_POLL_INTERVAL_MS);
    expect(playerDelay).toBe(HIDDEN_POLL_INTERVAL_MS);
    // Piilotettu välilehti ei koskaan lakkaa kysymästä: viive on aina äärellinen.
    expect(Number.isFinite(hostDelay)).toBe(true);
    expect(hostDelay).toBeGreaterThan(0);
  });

  it("hidastaa kyselyä eniten, kun peli on päättynyt", () => {
    expect(
      nextPollDelayMs({ hidden: false, status: "finished", intervalMs: HOST_INTERVAL }),
    ).toBe(FINISHED_POLL_INTERVAL_MS);
    // Päättynyt peli voittaa myös piilotetun välilehden säännön (suurempi viive).
    expect(
      nextPollDelayMs({ hidden: true, status: "finished", intervalMs: HOST_INTERVAL }),
    ).toBe(FINISHED_POLL_INTERVAL_MS);
  });

  it("ei koskaan lyhennä väliä alle pyydetyn", () => {
    const longInterval = 8000;

    expect(nextPollDelayMs({ hidden: false, status: "lobby", intervalMs: longInterval })).toBe(
      longInterval,
    );
    expect(nextPollDelayMs({ hidden: true, status: "lobby", intervalMs: longInterval })).toBe(
      longInterval,
    );
    expect(
      nextPollDelayMs({ hidden: false, status: "finished", intervalMs: longInterval }),
    ).toBe(longInterval);
  });

  it("käsittelee tuntemattoman tilan normaalina kyselynä", () => {
    expect(nextPollDelayMs({ hidden: false, status: null, intervalMs: HOST_INTERVAL })).toBe(
      HOST_INTERVAL,
    );
    expect(nextPollDelayMs({ hidden: false, status: "tuntematon", intervalMs: HOST_INTERVAL })).toBe(
      HOST_INTERVAL,
    );
  });
});
