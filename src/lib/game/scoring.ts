/**
 * Palvelinpuolen pisteytys. Puhdas funktio, ei riippuvuuksia selaimesta.
 *
 * Kaava: points = round(maxPoints * (1 - 0.5 * elapsedMs / timeLimitMs))
 *
 * - Nopea oikea vastaus saa lähes täydet pisteet.
 * - Aikarajan lopussa oikea vastaus saa noin puolet maksimista.
 * - Väärä vastaus saa aina 0 pistettä.
 * - Myöhässä saapunut vastaus hylätään (0 pistettä) – se ei ole enää voimassa.
 */

export type ScoreInput = {
  isCorrect: boolean;
  /** Palvelimen kellosta laskettu kulunut aika kysymyksen alusta. */
  elapsedMs: number;
  /** Kysymyksen aikaraja millisekunteina. */
  timeLimitMs: number;
  /** Kysymyksen enimmäispistemäärä. */
  maxPoints: number;
};

export const MIN_POINTS_FACTOR = 0.5;

export function calculatePoints({ isCorrect, elapsedMs, timeLimitMs, maxPoints }: ScoreInput): number {
  if (!isCorrect) {
    return 0;
  }

  if (!Number.isFinite(maxPoints) || maxPoints <= 0) {
    return 0;
  }

  if (!Number.isFinite(timeLimitMs) || timeLimitMs <= 0) {
    return Math.round(maxPoints);
  }

  if (!Number.isFinite(elapsedMs) || elapsedMs > timeLimitMs) {
    return 0;
  }

  const clampedElapsed = Math.max(0, elapsedMs);
  const factor = 1 - MIN_POINTS_FACTOR * (clampedElapsed / timeLimitMs);
  const points = Math.round(maxPoints * factor);

  return Math.min(maxPoints, Math.max(0, points));
}

/** Apuri: kysymyksen aikaraja sekunteina → millisekunteina. */
export function timeLimitToMs(timeLimitSeconds: number): number {
  return Math.max(0, Math.round(timeLimitSeconds * 1000));
}
