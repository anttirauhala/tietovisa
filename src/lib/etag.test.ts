import { describe, expect, it } from "vitest";

import { matchesEtag, stateEtag } from "./etag";

/**
 * ETag-testit (vaihe 2b).
 *
 * Testit varmistavat, että tunniste on vakaa (sama tila → sama tunniste),
 * että se muuttuu tilan muuttuessa ja että If-None-Match-vertailu noudattaa
 * HTTP-spesifikaation sääntöjä (useita arvoja, jokerimerkki, heikko vertailu).
 */

describe("stateEtag", () => {
  it("palauttaa saman tunnisteen samansisältöiselle tilalle", () => {
    const first = stateEtag({ role: "host", room: { status: "question" } });
    const second = stateEtag({ role: "host", room: { status: "question" } });

    expect(first).toBe(second);
  });

  it("muuttuu, kun pelin tila muuttuu", () => {
    const before = stateEtag({ room: { status: "question", answerCount: 0 } });
    const after = stateEtag({ room: { status: "question", answerCount: 1 } });

    expect(before).not.toBe(after);
  });

  it("ei huomioi serverNow-kelloa, jotta muuttumaton tila tunnistetaan", () => {
    const first = stateEtag({
      serverNow: "2026-01-01T00:00:00.000Z",
      room: { status: "lobby" },
    });
    const second = stateEtag({
      serverNow: "2026-01-01T00:00:01.000Z",
      room: { status: "lobby" },
    });

    expect(first).toBe(second);
  });

  it("ei riipu kenttien kirjoitusjärjestyksestä", () => {
    expect(stateEtag({ room: 1, players: 2 })).toBe(stateEtag({ players: 2, room: 1 }));
  });

  it("on heikon ETagin muodossa", () => {
    expect(stateEtag({ room: {} })).toMatch(/^W\/"[A-Za-z0-9_-]{22}"$/);
  });
});

describe("matchesEtag", () => {
  const etag = 'W/"abc"';

  it("ei täsmää ilman If-None-Match-otsikkoa", () => {
    expect(matchesEtag(null, etag)).toBe(false);
    expect(matchesEtag("", etag)).toBe(false);
  });

  it("täsmää samaan tunnisteeseen", () => {
    expect(matchesEtag(etag, etag)).toBe(true);
  });

  it("täsmää vahvaksi kirjoitettuun tunnisteeseen (heikko vertailu)", () => {
    expect(matchesEtag('"abc"', etag)).toBe(true);
  });

  it("täsmää, kun otsikossa on useita arvoja", () => {
    expect(matchesEtag('W/"muu", W/"abc", W/"kolmas"', etag)).toBe(true);
  });

  it("täsmää jokerimerkkiin", () => {
    expect(matchesEtag("*", etag)).toBe(true);
  });

  it("ei täsmää eri tunnisteeseen", () => {
    expect(matchesEtag('W/"toinen"', etag)).toBe(false);
  });
});
