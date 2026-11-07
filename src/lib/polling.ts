/**
 * Kyselyvälin valinta. Puhdas funktio, jotta käyttäytyminen on testattavissa.
 *
 * Kyselyä ei pysäytetä kesken pelin: jos välilehti on piilossa, väliä
 * pidennetään. Tämä on tärkeää juontajalle – jos hän vaihtaa välilehteä tai
 * toinen sovellus peittää ruudun, uusien pelaajien liittyminen näkyisi muuten
 * vasta kun hän palaa välilehdelle. Ainoa poikkeus on päättynyt peli, jossa
 * kysely lopetetaan kokonaan (tila ei voi enää muuttua).
 *
 * Pelaajalla on lisäksi kysymysvaiheen hiljainen ikkuna: kysymyksen aikana
 * pelaajan näkymä ei voi muuttua mistään muusta syystä kuin siitä, että
 * juontaja keskeyttää kysymyksen. Oma vastaus päivitetään heti vastauksen
 * jälkeen tehdyllä erillisellä kyselyllä ja ajastin lasketaan paikallisesti
 * määräajasta, joten välillä ei tarvita sekunnin tahtia. Ikkunan pituus
 * rajataan turvakatolla, jotta juontajan keskeytys näkyy pelaajalle
 * kohtuullisella viiveellä.
 */

export const DEFAULT_POLL_INTERVAL_MS = 1000;
/** Piilotetun välilehden kyselyväli: hidastettu, mutta ei pysäytetty. */
export const HIDDEN_POLL_INTERVAL_MS = 4000;
/**
 * Pelaajan kysymysvaiheen hiljaisen ikkunan enimmäispituus.
 * Toimii turvakattona: juontajan "Lopeta kysymys nyt" näkyy pelaajalle
 * enintään tämän verran myöhemmin.
 */
export const PLAYER_QUESTION_QUIET_MAX_MS = 5000;
/** Kuinka lähellä määräaikaa palataan normaaliin kyselytahtiin. */
export const PLAYER_DEADLINE_FAST_WINDOW_MS = 1000;

export type PollingState = {
  /** Onko välilehti piilossa (document.visibilityState === "hidden"). */
  hidden: boolean;
  /** Huoneen nykyinen tila, jos tiedossa. */
  status: string | null;
  /** Roolikohtainen perusväli (juontaja 900 ms, pelaaja 1100 ms). */
  intervalMs: number;
  /** Kysyjä. Juontajalla ei ole hiljaista ikkunaa, koska se näyttää vastausmäärän. */
  role: "host" | "player";
  /** Kysymyksen määräaika palvelimen kellona (ms), tai null jos ei tiedossa. */
  questionEndsAtMs: number | null;
  /** Palvelimen ja selaimen kellon ero (ms): palvelin = selain + ero. */
  clockOffsetMs: number;
  /** Selaimen kellonaika kyselyhetkellä (ms). */
  nowMs: number;
};

export function nextPollDelayMs({
  hidden,
  status,
  intervalMs,
  role,
  questionEndsAtMs,
  clockOffsetMs,
  nowMs,
}: PollingState): number | null {
  /*
   * Peli on päättynyt. `finished` on tilakoneen terminaalinen tila, joten uutta
   * tietoa ei ole eikä tule: kysely lopetetaan kokonaan sen sijaan että sitä
   * vain hidastettaisiin. Muuten avoimeksi jäänyt pelaajavälilehti kuluttaisi
   * invokaatio- ja egress-kiintiötä loputtomiin.
   */
  if (status === "finished") {
    return null;
  }

  if (hidden) {
    return Math.max(HIDDEN_POLL_INTERVAL_MS, intervalMs);
  }

  const quietDelayMs = playerQuestionQuietDelayMs({
    role,
    status,
    questionEndsAtMs,
    clockOffsetMs,
    nowMs,
  });

  return Math.max(intervalMs, quietDelayMs ?? 0);
}

/**
 * Kuinka kauan yksittäinen tilakysely saa kestää ennen kuin se peruutetaan.
 *
 * Mobiiliyhteydellä pyyntö voi jäädä roikkumaan (solu vaihtuu, hissi, kuollut
 * mutta avoin yhteys), eikä selain katkaise sitä itse. Ilman aikakatkaisua
 * roikkuva pyyntö estää näkymän päivittymisen kymmeniä sekunteja – pahimmillaan
 * pelaaja menettää koko kysymyksen.
 *
 * Aikakatkaisu on kaksi kyselyväliä, joten hidas mutta toimiva pyyntö ehtii
 * valmistua ennen kuin päällekkäisiä pyyntöjä kerääntyy monta. Alaraja suojaa
 * palvelimen kylmäkäynnistykseltä, joka voi kestää yli sekunnin.
 */
export const POLL_TIMEOUT_MIN_MS = 4000;

export function pollTimeoutMs(delayMs: number): number {
  return Math.max(POLL_TIMEOUT_MIN_MS, delayMs * 2);
}

/**
 * Pelaajan hiljainen ikkuna kesken kysymystä: kysytään harvemmin, mutta
 * korkeintaan turvakaton verran. Palauttaa null, kun normaali tahti riittää
 * (juontaja, muu vaihe, määräaika käsillä tai määräaika ei tiedossa).
 */
function playerQuestionQuietDelayMs({
  role,
  status,
  questionEndsAtMs,
  clockOffsetMs,
  nowMs,
}: Pick<
  PollingState,
  "role" | "status" | "questionEndsAtMs" | "clockOffsetMs" | "nowMs"
>): number | null {
  if (role !== "player" || status !== "question" || questionEndsAtMs === null) {
    return null;
  }

  if (!Number.isFinite(questionEndsAtMs)) {
    return null;
  }

  const remainingMs = questionEndsAtMs - (nowMs + clockOffsetMs);

  if (remainingMs <= PLAYER_DEADLINE_FAST_WINDOW_MS) {
    // Määräaika on käsillä: kysytään normaalisti, jotta tulosvaihe näkyy heti.
    return null;
  }

  return Math.min(PLAYER_QUESTION_QUIET_MAX_MS, remainingMs);
}
