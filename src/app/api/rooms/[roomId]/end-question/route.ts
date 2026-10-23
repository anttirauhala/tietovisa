import { jsonErrorResponse, jsonResponse, parseWith, readJsonBody } from "@/lib/api/errors";
import { advanceRequestSchema } from "@/lib/api/schemas";
import { assertRoomId, enforceRateLimit, requireHostToken } from "@/lib/api/server";
import { endQuestionNow } from "@/lib/rooms";
import { requireHostSession } from "@/lib/roomState";
import { hashToken } from "@/lib/tokens";

type RouteContext = { params: Promise<{ roomId: string }> };

/**
 * POST /api/rooms/[roomId]/end-question
 *
 * Keskeyttää käynnissä olevan kysymyksen heti: määräaika siirretään palvelimen
 * nykyhetkeen. Tämän jälkeen tavallinen tulosvaiheen siirtymä menee läpi.
 *
 * Vastaukset, jotka saapuvat tämän jälkeen, hylätään edelleen myöhäisinä.
 */
export async function POST(request: Request, context: RouteContext) {
  try {
    const { roomId } = await context.params;
    assertRoomId(roomId);
    enforceRateLimit(request, "rooms:host", 120, 60_000);

    const hostToken = requireHostToken(request);
    await requireHostSession(roomId, hostToken);
    parseWith(advanceRequestSchema, await readJsonBody(request));

    await endQuestionNow(roomId, hashToken(hostToken));

    return jsonResponse({ ok: true, status: "question" });
  } catch (error) {
    return jsonErrorResponse(error);
  }
}
