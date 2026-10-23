import {
  jsonErrorResponse,
  jsonResponse,
  parseWith,
  readJsonBody,
} from "@/lib/api/errors";
import { joinRoomRequestSchema } from "@/lib/api/schemas";
import { enforceRateLimit } from "@/lib/api/server";
import { joinRoom } from "@/lib/rooms";

/**
 * POST /api/rooms/join
 * Liittää pelaajan huoneeseen PIN-koodilla. PIN-koodi ei ole salaisuus:
 * käyttöoikeus perustuu erilliseen satunnaiseen istuntotokeniin.
 */
export async function POST(request: Request) {
  try {
    enforceRateLimit(request, "rooms:join", 20, 60_000);

    const body = parseWith(joinRoomRequestSchema, await readJsonBody(request));
    const result = await joinRoom(body.pin, body.nickname);

    return jsonResponse(result, 201);
  } catch (error) {
    return jsonErrorResponse(error);
  }
}
