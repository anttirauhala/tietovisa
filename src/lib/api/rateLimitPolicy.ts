import "server-only";

/**
 * Nopeusrajoitusten mitoitus.
 *
 * Arvot on nostettu omaksi moduulikseen kahdesta syystä: mitoitusperuste on
 * yhdessä paikassa dokumentoitu ja rajat ovat testattavissa
 * (ks. rateLimitPolicy.test.ts). Aiemmin liittymisraja oli liian tiukka
 * suurelle seurueelle, ja sama virhe olisi helppo tehdä uudelleen, jos luvut
 * ovat hajallaan route handlereissa.
 *
 * Rajat ovat prosessikohtaisia ja IP-pohjaisia (lib/rateLimit.ts). Pelaajat
 * liittyvät omilla puhelimillaan mobiiliverkosta, joten yksi julkinen
 * IP-osoite voi olla jaettu kahdella eri tavalla: IPv6:ssa jokaisella
 * laitteella on yleensä oma osoite, mutta operaattorin CGNAT voi näyttää
 * usean liittyjän – jopa satunnaisen tuntemattoman – samana IPv4-osoitteena.
 * Rajoitin ei voi erottaa seuruetta muista saman osoitteen käyttäjistä, joten
 * raja mitoitetaan koko huoneen – ei yksittäisen pelaajan – mukaan. Sama
 * mitoitus on turvallinen myös silloin, jos joku jakaa yhteyden hotspotilla.
 */

/**
 * Tietokannan pelaajakatto: `public.join_room` hyväksyy huoneeseen enintään
 * tämän monta pelaajaa (supabase/migrations/20260101000100_functions.sql).
 */
export const ROOM_PLAYER_CAPACITY = 200;

/**
 * Liittymiset minuutissa. Koko seurue liittyy kerralla, kun QR-koodi näytetään,
 * joten rajan pitää riittää täyteen huoneeseen (200) yhden minuutin aikana ja
 * jättää varaa uudelleenyrityksille (nimimerkkitörmäys, hetkellinen
 * verkkokatko). 75 pelaajan pikkujoulu käyttää rajasta noin 30 %.
 */
export const JOIN_RATE_LIMIT_PER_MINUTE = 250;

/** Pelaajan tilakyselyn perusväli millisekunteina (PlayerRoom: intervalMs). */
export const PLAYER_POLL_INTERVAL_MS = 1100;

/** Juontajan tilakyselyn väli millisekunteina (HostRoom: intervalMs). */
export const HOST_POLL_INTERVAL_MS = 900;

/**
 * Montako tilakyselyä huone tuottaa minuutissa pahimmillaan: kaikki pelaajat
 * näkyvällä välilehdellä perustahdilla (lobby, tulosvaihe, tulostaulu) sekä
 * juontaja. Kysymysvaiheessa pelaajan väli on pidempi (lib/polling.ts), joten
 * todellinen kuorma on tätä pienempi.
 */
export function statePollsPerMinute(players: number): number {
  return Math.ceil((players * 60_000) / PLAYER_POLL_INTERVAL_MS + 60_000 / HOST_POLL_INTERVAL_MS);
}

/**
 * Tilakyselyt minuutissa. Mitoitettu tietokannan pelaajakaton mukaan: täysi
 * 200 pelaajan huone tuottaa pahimmillaan noin 11 000 pyyntöä minuutissa, mikä
 * on 55 % rajasta. 75 pelaajan huone jää noin 21 %:iin (≈4 200/min), joten
 * satunnaiset uudelleenlataukset ja toiset välilehdet mahtuvat mukaan.
 * Yläraja estää silti yksittäistä IP:tä kuormittamasta tietokantaa enempää kuin
 * noin 330 pyyntöä sekunnissa.
 */
export const STATE_RATE_LIMIT_PER_MINUTE = 20_000;
