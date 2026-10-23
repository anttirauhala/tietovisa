import { describe, expect, it } from "vitest";

import { rankPlayers } from "./leaderboard";

function player(id: string, score: number, correctCount = 0, joinedAt = "2026-01-01T10:00:00.000Z") {
  return { id, nickname: id.toUpperCase(), score, correctCount, joinedAt };
}

describe("rankPlayers", () => {
  it("järjestää pelaajat pisteiden mukaan laskevasti", () => {
    const ranked = rankPlayers([
      player("a", 100),
      player("b", 900),
      player("c", 500),
    ]);

    expect(ranked.map((entry) => entry.id)).toEqual(["b", "c", "a"]);
    expect(ranked.map((entry) => entry.rank)).toEqual([1, 2, 3]);
  });

  it("ratkaisee tasapisteet oikeiden vastausten määrällä", () => {
    const ranked = rankPlayers([
      player("a", 900, 1),
      player("b", 900, 3),
      player("c", 900, 2),
    ]);

    expect(ranked.map((entry) => entry.id)).toEqual(["b", "c", "a"]);
  });

  it("antaa jaetun sijoituksen täsmälleen samoilla pisteillä ja oikeilla vastauksilla", () => {
    const ranked = rankPlayers([
      player("a", 900, 3, "2026-01-01T10:00:00.000Z"),
      player("b", 900, 3, "2026-01-01T10:05:00.000Z"),
      player("c", 500, 1),
    ]);

    expect(ranked.map((entry) => entry.rank)).toEqual([1, 1, 3]);
    expect(ranked[0].isTied).toBe(true);
    expect(ranked[1].isTied).toBe(true);
    expect(ranked[2].isTied).toBe(false);
  });

  it("on deterministinen myös täysin identtisillä pelaajilla", () => {
    const input = [
      player("b", 400, 2, "2026-01-01T10:00:00.000Z"),
      player("a", 400, 2, "2026-01-01T10:00:00.000Z"),
      player("c", 400, 2, "2026-01-01T10:00:00.000Z"),
    ];

    const first = rankPlayers(input).map((entry) => entry.id);
    const second = rankPlayers([...input].reverse()).map((entry) => entry.id);

    expect(first).toEqual(["a", "b", "c"]);
    expect(second).toEqual(first);
  });

  it("ei muuta alkuperäistä taulukkoa", () => {
    const input = [player("a", 100), player("b", 200)];
    rankPlayers(input);
    expect(input.map((entry) => entry.id)).toEqual(["a", "b"]);
  });

  it("käsittelee tyhjän listan", () => {
    expect(rankPlayers([])).toEqual([]);
  });

  it("antaa saman sijoituksen vain täsmälleen samoilla tunnusluvuilla", () => {
    const ranked = rankPlayers([
      player("a", 900, 3),
      player("b", 900, 2),
    ]);

    expect(ranked[0].rank).toBe(1);
    expect(ranked[1].rank).toBe(2);
    expect(ranked.every((entry) => entry.isTied)).toBe(false);
  });
});
