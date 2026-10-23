import { jsonErrorResponse, jsonResponse, parseWith, readJsonBody } from "@/lib/api/errors";
import { advanceRequestSchema } from "@/lib/api/schemas";
import { assertRoomId, enforceRateLimit, requireHostToken } from "@/lib/api/server";
import { finishRoom } from "@/lib/rooms";
import { requireHostSession } from "@/lib/roomState";
import { hashToken } from "@/lib/tokens";

type RouteContext = { params: Promise<{ roomId: string }> };

/**
 * POST /api/rooms/[roomId]/finish
 *
 * leaderboard → finished. Päättää pelin kesken kysymyssarjan, jos juontaja
 * haluaa lopettaa aiemmin (esim. aikataulun vuoksi). Tilakone sallii siirtymän
 * vain tulostaululta, joten tulosvaiheen kautta kuljetaan aina.
 */
export async function POST(request: Request, context: RouteContext) {
  try {
    const { roomId } = await context.params;
    assertRoomId(roomId);
    enforceRateLimit(request, "rooms:host", 120, 60_000);

    const hostToken = requireHostToken(request);
    await requireHostSession(roomId, hostToken);
    parseWith(advanceRequestSchema, await readJsonBody(request));

    await finishRoom(roomId, hashToken(hostToken));

    return jsonResponse({ ok: true, status: "finished" });
  } catch (error) {
    return jsonErrorResponse(error);
  }
}
