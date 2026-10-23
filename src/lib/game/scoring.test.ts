import { describe, expect, it } from "vitest";

import { calculatePoints, timeLimitToMs } from "./scoring";

const TIME_LIMIT_MS = 20_000;
const MAX_POINTS = 1000;

function score(isCorrect: boolean, elapsedMs: number, maxPoints = MAX_POINTS) {
  return calculatePoints({ isCorrect, elapsedMs, timeLimitMs: TIME_LIMIT_MS, maxPoints });
}

describe("calculatePoints", () => {
  it("antaa väärästä vastauksesta nolla pistettä", () => {
    expect(score(false, 0)).toBe(0);
    expect(score(false, 5000)).toBe(0);
    expect(score(false, TIME_LIMIT_MS)).toBe(0);
  });

  it("antaa täydet pisteet välittömästä oikeasta vastauksesta", () => {
    expect(score(true, 0)).toBe(MAX_POINTS);
  });

  it("antaa noin puolet pisteistä aikarajan lopussa", () => {
    expect(score(true, TIME_LIMIT_MS)).toBe(500);
  });

  it("antaa nopeammasta oikeasta vastauksesta vähintään yhtä paljon kuin hitaammasta", () => {
    const elapsedValues = [0, 500, 1000, 2500, 5000, 9999, 15_000, 19_999, TIME_LIMIT_MS];
    const points = elapsedValues.map((elapsed) => score(true, elapsed));

    for (let index = 1; index < points.length; index += 1) {
      expect(points[index]).toBeLessThanOrEqual(points[index - 1]);
    }
    expect(points[0]).toBeGreaterThan(points[points.length - 1]);
  });

  it("ei koskaan ylitä maksimipistemäärää eikä alita nollaa", () => {
    const elapsedValues = [-5000, -1, 0, 1, 100, 1000, TIME_LIMIT_MS, TIME_LIMIT_MS + 1, 60_000];

    for (const elapsed of elapsedValues) {
      const points = score(true, elapsed);
      expect(points).toBeGreaterThanOrEqual(0);
      expect(points).toBeLessThanOrEqual(MAX_POINTS);
    }
  });

  it("antaa nolla pistettä, kun vastaus saapui aikarajan jälkeen", () => {
    expect(score(true, TIME_LIMIT_MS + 1)).toBe(0);
    expect(score(true, TIME_LIMIT_MS + 5_000)).toBe(0);
  });

  it("kunnioittaa kysymyksen omaa maksimipistemäärää", () => {
    expect(score(true, 0, 800)).toBe(800);
    expect(score(true, TIME_LIMIT_MS, 800)).toBe(400);
  });

  it("käsittelee virheelliset aikarajat turvallisesti", () => {
    expect(
      calculatePoints({ isCorrect: true, elapsedMs: 100, timeLimitMs: 0, maxPoints: 1000 }),
    ).toBe(1000);
    expect(
      calculatePoints({ isCorrect: true, elapsedMs: 100, timeLimitMs: -10, maxPoints: 1000 }),
    ).toBe(1000);
    expect(
      calculatePoints({
        isCorrect: true,
        elapsedMs: Number.NaN,
        timeLimitMs: TIME_LIMIT_MS,
        maxPoints: 1000,
      }),
    ).toBe(0);
  });

  it("antaa nolla pistettä, jos maksimipistemäärä on virheellinen", () => {
    expect(score(true, 0, 0)).toBe(0);
    expect(score(true, 0, -100)).toBe(0);
  });

  it("muuntaa aikarajan sekunneista millisekunneiksi", () => {
    expect(timeLimitToMs(20)).toBe(20_000);
    expect(timeLimitToMs(0)).toBe(0);
    expect(timeLimitToMs(-3)).toBe(0);
  });
});
