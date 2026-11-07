import { ApiError, jsonErrorResponse } from "@/lib/api/errors";
import { jsonStateResponse } from "@/lib/api/conditional";
import { readHostToken, readPlayerToken, enforceRateLimit } from "@/lib/api/server";
import { STATE_RATE_LIMIT_PER_MINUTE } from "@/lib/api/rateLimitPolicy";
import { buildHostState, buildPlayerState } from "@/lib/roomState";

type RouteContext = { params: Promise<{ roomId: string }> };

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * GET /api/rooms/[roomId]/state
 *
 * Palauttaa roolikohtaisen julkisen pelitilan. Juontajan istunto tunnistetaan
 * otsikosta x-host-token ja pelaajan istunto otsikosta x-player-token.
 *
 * Oikeaa vastausta ei palauteta pelaajalle ennen tulosvaihetta.
 * Selain käyttää tätä myös reaaliaikaisen päivityksen lähteenä (ks. README:
 * miksi palvelinvälitteinen tila on turvallisempi kuin suora Realtime-tilaus).
 *
 * Vastaus on ehdollinen (ETag + If-None-Match): kun tila on ennallaan,
 * palvelin vastaa 304 Not Modified ilman runkoa. Selain säilyttää silloin
 * aiemman tilansa, joten sekunnin välein toistuva kysely ei siirrä
 * pelaajalistoja eikä kysymyssisältöä turhaan.
 */
export async function GET(request: Request, context: RouteContext) {
  try {
    const { roomId } = await context.params;

    if (!UUID_PATTERN.test(roomId)) {
      throw new ApiError(404, "not_found", "Pelihuonetta ei löytynyt.");
    }

    /*
     * Väljä raja: estää ilmeisen väärinkäytön, ei rajoita normaalia kyselyä.
     *
     * Mitoitus: pelaaja kysyy tilaa lobby- ja tulostauluvaiheessa 1,1 sekunnin
     * välein, joten 75 pelaajan huone tuottaa noin 4 200 pyyntöä minuutissa
     * (21 % rajasta) ja kysymysvaiheessa huomattavasti vähemmän. Tietokannan
     * pelaajakatto on 200 (join_room), mikä on noin 11 000 pyyntöä minuutissa
     * (55 % rajasta). Raja riittää siis täyteenkin huoneeseen ja jättää varaa
     * satunnaisille uudelleenlatauksille ja toisille välilehdille.
     *
     * Pelaajat käyttävät mobiiliverkkoa, joten kuorma jakautuu usealle
     * IP-osoitteelle (IPv6) tai muutaman CGNAT-osoitteen kesken. Raja on siksi
     * ensisijaisesti väärinkäytön este, ei kapasiteettiraja. Yläraja on silti
     * olemassa: yksittäinen IP ei voi kuormittaa tietokantaa enempää kuin noin
     * 330 pyyntöä sekunnissa.
     */
    enforceRateLimit(request, "rooms:state", STATE_RATE_LIMIT_PER_MINUTE, 60_000);

    const hostToken = readHostToken(request);
    if (hostToken) {
      return jsonStateResponse(request, await buildHostState(roomId, hostToken));
    }

    const playerToken = readPlayerToken(request);
    if (playerToken) {
      return jsonStateResponse(request, await buildPlayerState(roomId, playerToken));
    }

    throw new ApiError(401, "invalid_token", "Istunto puuttuu. Liity peliin uudelleen.");
  } catch (error) {
    return jsonErrorResponse(error);
  }
}
