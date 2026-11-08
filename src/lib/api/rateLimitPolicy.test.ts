import { describe, expect, it } from "vitest";

import {
  ANSWER_RATE_LIMIT_PER_MINUTE,
  JOIN_RATE_LIMIT_PER_MINUTE,
  ROOM_PLAYER_CAPACITY,
  STATE_RATE_LIMIT_PER_MINUTE,
  statePollsPerMinute,
} from "./rateLimitPolicy";

/**
 * Nämä testit lukitsevat mitoitusperusteen. Ne eivät testaa rajoittimen
 * mekaniikkaa (ks. lib/rateLimit.ts) vaan sitä, että rajat ovat riittävän
 * väljiä yhdelle pikkujouluseurueelle – liian tiukka raja on aiemmin estänyt
 * osan vieraista liittymästä.
 */
describe("nopeusrajoitusten mitoitus", () => {
  it("liittymisraja riittää koko huoneelle yhden minuutin aikana", () => {
    expect(JOIN_RATE_LIMIT_PER_MINUTE).toBeGreaterThanOrEqual(ROOM_PLAYER_CAPACITY);
  });

  it("75 pelaajan seurue mahtuu liittymisrajaan selvällä marginaalilla", () => {
    expect(JOIN_RATE_LIMIT_PER_MINUTE).toBeGreaterThan(75 * 2);
  });

  it("75 pelaajan pahin tilakyselytahti on alle puolet rajasta", () => {
    expect(statePollsPerMinute(75)).toBe(4158);
    expect(statePollsPerMinute(75)).toBeLessThan(STATE_RATE_LIMIT_PER_MINUTE / 2);
  });

  it("täysi 200 pelaajan huone mahtuu tilakyselyn rajaan", () => {
    expect(statePollsPerMinute(ROOM_PLAYER_CAPACITY)).toBeLessThan(STATE_RATE_LIMIT_PER_MINUTE);
  });

  it("vastausraja kattaa kahden peräkkäisen kysymyksen vastaukset täydestä huoneesta", () => {
    // Kysymysten aikaraja on 15 s, joten rivakalla juontajalla kahden
    // kysymyksen vastaukset voivat osua samaan 60 s liukuvaan ikkunaan.
    expect(ANSWER_RATE_LIMIT_PER_MINUTE).toBeGreaterThanOrEqual(ROOM_PLAYER_CAPACITY * 2);
  });

  it("75 pelaajan seurue käyttää vastausrajasta korkeintaan kolmanneksen", () => {
    // Pahin tapaus: kaksi kysymystä samassa ikkunassa = 2 x 75 = 150 vastausta.
    expect(75 * 2).toBeLessThanOrEqual(ANSWER_RATE_LIMIT_PER_MINUTE / 3);
  });

  it("kysymysvaiheen hiljainen ikkuna ei kasvata huipputahtia", () => {
    // Pelaajan perusväli 1,1 s on lyhin mahdollinen, joten pahin tahti saadaan
    // pelaajamäärästä eikä vaiheesta: jokainen lisäpelaaja tuo ~54,5 pyyntöä/min.
    expect(statePollsPerMinute(76) - statePollsPerMinute(75)).toBeGreaterThanOrEqual(54);
  });
});
