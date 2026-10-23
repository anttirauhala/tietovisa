import { describe, expect, it } from "vitest";

import {
  clampToQuestionLength,
  computeClockOffset,
  formatClock,
  progressRatio,
  remainingMs,
  toDisplaySeconds,
} from "./time";

const NOW = Date.parse("2026-01-01T12:00:00.000Z");

describe("aika-apurit", () => {
  it("laskee kellon korjauksen palvelimen ajasta", () => {
    expect(computeClockOffset("2026-01-01T12:00:02.000Z", NOW)).toBe(2000);
    expect(computeClockOffset("2026-01-01T11:59:58.000Z", NOW)).toBe(-2000);
    expect(computeClockOffset("ei-aika", NOW)).toBe(0);
  });

  it("laskee jäljellä olevan ajan palvelimen määräajasta", () => {
    expect(remainingMs("2026-01-01T12:00:20.000Z", NOW)).toBe(20_000);
    expect(remainingMs("2026-01-01T12:00:20.000Z", NOW, 2000)).toBe(18_000);
    expect(remainingMs(null, NOW)).toBeNull();
    expect(remainingMs("rikki", NOW)).toBeNull();
  });

  it("laskee etenemisen välillä 0–1", () => {
    const startedAt = "2026-01-01T12:00:00.000Z";
    const endsAt = "2026-01-01T12:00:10.000Z";

    expect(progressRatio(startedAt, endsAt, NOW)).toBe(0);
    expect(progressRatio(startedAt, endsAt, NOW + 5000)).toBeCloseTo(0.5, 5);
    expect(progressRatio(startedAt, endsAt, NOW + 30_000)).toBe(1);
    expect(progressRatio(startedAt, endsAt, NOW - 5000)).toBe(0);
    expect(progressRatio(null, endsAt, NOW)).toBe(0);
  });

  it("muotoilee näytettävät sekunnit", () => {
    expect(toDisplaySeconds(19_999)).toBe(20);
    expect(toDisplaySeconds(1)).toBe(1);
    expect(toDisplaySeconds(0)).toBe(0);
    expect(toDisplaySeconds(-500)).toBe(0);
    expect(toDisplaySeconds(null)).toBe(0);
  });

  it("muotoilee kellonajan", () => {
    expect(formatClock(65)).toBe("1:05");
    expect(formatClock(9)).toBe("0:09");
  });

  it("rajaa jäljellä olevan ajan kysymyksen kokonaiskestoon", () => {
    const startedAt = "2026-01-01T12:00:00.000Z";
    const endsAt = "2026-01-01T12:00:20.000Z";

    // Kellon päivitys on vielä kesken: laskettu aika olisi valtava.
    expect(clampToQuestionLength(1_790_000_000_000, startedAt, endsAt)).toBe(20_000);
    // Normaali tilanne säilyy ennallaan.
    expect(clampToQuestionLength(12_345, startedAt, endsAt)).toBe(12_345);
    // Puuttuvat tai virheelliset aikaleimat eivät muuta arvoa.
    expect(clampToQuestionLength(5000, null, endsAt)).toBe(5000);
    expect(clampToQuestionLength(5000, startedAt, null)).toBe(5000);
    expect(clampToQuestionLength(null, startedAt, endsAt)).toBeNull();
  });
});
