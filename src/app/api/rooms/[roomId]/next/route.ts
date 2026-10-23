import { jsonErrorResponse, jsonResponse, parseWith, readJsonBody } from "@/lib/api/errors";
import { advanceRequestSchema } from "@/lib/api/schemas";
import { assertRoomId, enforceRateLimit, requireHostToken } from "@/lib/api/server";
import { advanceFromLeaderboard } from "@/lib/rooms";
import { requireHostSession } from "@/lib/roomState";
import { hashToken } from "@/lib/tokens";

type RouteContext = { params: Promise<{ roomId: string }> };

/**
 * POST /api/rooms/[roomId]/next
 * leaderboard → question (seuraava kysymys) tai leaderboard → finished.
 *
 * Jos kysymyksiä on jäljellä, käynnistetään seuraava. Muuten peli päätetään.
 * Kaksi nopeaa peräkkäistä komentoa eivät voi hypätä kysymyksen yli, koska
 * RPC lukitsee huonerivin ja tarkistaa nykyisen tilan.
 */
export async function POST(request: Request, context: RouteContext) {
  try {
    const { roomId } = await context.params;
    assertRoomId(roomId);
    enforceRateLimit(request, "rooms:host", 120, 60_000);

    const hostToken = requireHostToken(request);
    await requireHostSession(roomId, hostToken);
    parseWith(advanceRequestSchema, await readJsonBody(request));

    const nextStatus = await advanceFromLeaderboard(roomId, hashToken(hostToken));

    return jsonResponse({ ok: true, status: nextStatus });
  } catch (error) {
    return jsonErrorResponse(error);
  }
}
