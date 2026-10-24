import "server-only";

import { matchesEtag, stateEtag } from "@/lib/etag";

/**
 * Ehdollinen JSON-vastaus pelitilalle (vaihe 2b).
 *
 * Tilakysely toistuu noin sekunnin välein sekä juontajalla että pelaajilla.
 * Kun tila on ennallaan, palvelin vastaa 304 Not Modified ilman runkoa:
 * selain säilyttää aiemman tilansa eikä verkkoon siirry pelaajalistoja,
 * kysymystekstejä eikä jakaumia.
 *
 * Palvelin tekee silti saman tietokantakyselyn kuin ennenkin, joten tämä
 * optimointi kohdistuu siirrettävään dataan ja selaimen työhön – ei
 * tietokantakuormaan.
 *
 * Tunniste lasketaan tilan sisällöstä eikä sisällä serverNow-kelloa, joten
 * eri roolit eivät voi saada toistensa vastausta: eri sisältö tuottaa aina
 * eri tunnisteen ja siten täyden vastauksen.
 */
export function jsonStateResponse(request: Request, state: object): Response {
  const etag = stateEtag(state);

  const headers = {
    etag,
    "cache-control": "no-store",
    // Vastaus riippuu istunnosta (token-otsikosta), joten välityspalvelin ei
    // saa koskaan käyttää samaa vastausta toiselle roolille.
    vary: "x-host-token, x-player-token",
  };

  if (matchesEtag(request.headers.get("if-none-match"), etag)) {
    return new Response(null, { status: 304, headers });
  }

  return Response.json(state, { status: 200, headers });
}
