import { ApiError, jsonErrorResponse, jsonResponse } from "@/lib/api/errors";
import { readHostToken, readPlayerToken, enforceRateLimit } from "@/lib/api/server";
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
 */
export async function GET(request: Request, context: RouteContext) {
  try {
    const { roomId } = await context.params;

    if (!UUID_PATTERN.test(roomId)) {
      throw new ApiError(404, "not_found", "Pelihuonetta ei löytynyt.");
    }

    // Väljä raja: estää ilmeisen väärinkäytön, ei rajoita normaalia kyselyä.
    enforceRateLimit(request, "rooms:state", 6000, 60_000);

    const hostToken = readHostToken(request);
    if (hostToken) {
      return jsonResponse(await buildHostState(roomId, hostToken));
    }

    const playerToken = readPlayerToken(request);
    if (playerToken) {
      return jsonResponse(await buildPlayerState(roomId, playerToken));
    }

    throw new ApiError(401, "invalid_token", "Istunto puuttuu. Liity peliin uudelleen.");
  } catch (error) {
    return jsonErrorResponse(error);
  }
}
