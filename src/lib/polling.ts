/**
 * Kyselyvälin valinta. Puhdas funktio, jotta käyttäytyminen on testattavissa.
 *
 * Kyselyä ei koskaan pysäytetä kokonaan: jos välilehti on piilossa, väliä
 * pidennetään. Tämä on tärkeää juontajalle – jos hän vaihtaa välilehteä tai
 * toinen sovellus peittää ruudun, uusien pelaajien liittyminen näkyisi muuten
 * vasta kun hän palaa välilehdelle.
 */

export const DEFAULT_POLL_INTERVAL_MS = 1000;
/** Piilotetun välilehden kyselyväli: hidastettu, mutta ei pysäytetty. */
export const HIDDEN_POLL_INTERVAL_MS = 4000;
/** Päättyneen pelin tila ei enää muutu, joten sitä kysytään harvoin. */
export const FINISHED_POLL_INTERVAL_MS = 5000;

export type PollingState = {
  /** Onko välilehti piilossa (document.visibilityState === "hidden"). */
  hidden: boolean;
  /** Huoneen nykyinen tila, jos tiedossa. */
  status: string | null;
  /** Roolikohtainen perusväli (juontaja 900 ms, pelaaja 1100 ms). */
  intervalMs: number;
};

export function nextPollDelayMs({ hidden, status, intervalMs }: PollingState): number {
  if (status === "finished") {
    return Math.max(FINISHED_POLL_INTERVAL_MS, intervalMs);
  }

  if (hidden) {
    return Math.max(HIDDEN_POLL_INTERVAL_MS, intervalMs);
  }

  return intervalMs;
}
