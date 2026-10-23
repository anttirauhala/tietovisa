/**
 * Aika-apurit. Puhdas moduuli, testattavissa ilman selainta.
 *
 * Palvelin on ajan auktoriteetti: kysymyksen alku- ja päättymisajat tulevat
 * palvelimelta, ja selaimen kelloa korjataan palvelimen ilmoittamalla ajalla.
 */

/** Selaimen kellon korjaus palvelimen aikaan nähden (ms). */
export function computeClockOffset(serverNow: string, receivedAtMs: number): number {
  const parsed = Date.parse(serverNow);
  if (Number.isNaN(parsed)) {
    return 0;
  }
  return parsed - receivedAtMs;
}

/** Jäljellä oleva aika millisekunteina, tai null jos määräaikaa ei ole. */
export function remainingMs(
  endsAt: string | null,
  nowMs: number,
  clockOffsetMs = 0,
): number | null {
  if (!endsAt) {
    return null;
  }
  const parsed = Date.parse(endsAt);
  if (Number.isNaN(parsed)) {
    return null;
  }
  return parsed - (nowMs + clockOffsetMs);
}

/** Kysymyksen eteneminen välillä 0–1. */
export function progressRatio(
  startedAt: string | null,
  endsAt: string | null,
  nowMs: number,
  clockOffsetMs = 0,
): number {
  if (!startedAt || !endsAt) {
    return 0;
  }
  const start = Date.parse(startedAt);
  const end = Date.parse(endsAt);
  if (Number.isNaN(start) || Number.isNaN(end) || end <= start) {
    return 0;
  }
  const elapsed = nowMs + clockOffsetMs - start;
  return Math.min(1, Math.max(0, elapsed / (end - start)));
}

/** Sekunnit ylöspäin pyöristettynä, vähintään 0. */
export function toDisplaySeconds(remaining: number | null): number {
  if (remaining === null || Number.isNaN(remaining)) {
    return 0;
  }
  return Math.max(0, Math.ceil(remaining / 1000));
}

/**
 * Rajaa jäljellä olevan ajan kysymyksen kokonaiskestoon.
 *
 * Näyttökello päivittyy hieman jäljessä (esim. kun kysymys juuri alkoi ja
 * kellon päivitys on vielä kesken), jolloin laskettu jäljellä oleva aika voi
 * näyttää liian suurelta. Kysymyksen aikaraja on luonnollinen yläraja.
 */
export function clampToQuestionLength(
  remaining: number | null,
  startedAt: string | null,
  endsAt: string | null,
): number | null {
  if (remaining === null) {
    return null;
  }

  if (!startedAt || !endsAt) {
    return remaining;
  }

  const start = Date.parse(startedAt);
  const end = Date.parse(endsAt);

  if (Number.isNaN(start) || Number.isNaN(end) || end <= start) {
    return remaining;
  }

  return Math.min(remaining, end - start);
}

export function formatClock(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}
