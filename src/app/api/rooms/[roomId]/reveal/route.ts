import { jsonErrorResponse, jsonResponse, parseWith, readJsonBody } from "@/lib/api/errors";
import { advanceRequestSchema } from "@/lib/api/schemas";
import { assertRoomId, enforceRateLimit, requireHostToken } from "@/lib/api/server";
import { revealQuestion } from "@/lib/rooms";
import { requireHostSession } from "@/lib/roomState";
import { hashToken } from "@/lib/tokens";

type RouteContext = { params: Promise<{ roomId: string }> };

/**
 * POST /api/rooms/[roomId]/reveal
 * question → question_result. Palvelin hyväksyy siirtymän vain, kun kysymyksen
 * määräaika on kulunut, joten oikea vastaus ei voi paljastua kesken kysymyksen.
 * Kutsu on idempotentti: sama komento uudelleen ei muuta tilaa.
 */
export async function POST(request: Request, context: RouteContext) {
  try {
    const { roomId } = await context.params;
    assertRoomId(roomId);
    enforceRateLimit(request, "rooms:host", 120, 60_000);

    const hostToken = requireHostToken(request);
    await requireHostSession(roomId, hostToken);
    parseWith(advanceRequestSchema, await readJsonBody(request));

    await revealQuestion(roomId, hashToken(hostToken));

    return jsonResponse({ ok: true, status: "question_result" });
  } catch (error) {
    return jsonErrorResponse(error);
  }
}
