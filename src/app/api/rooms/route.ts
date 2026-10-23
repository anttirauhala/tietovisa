import {
  jsonErrorResponse,
  jsonResponse,
  parseWith,
  readJsonBody,
} from "@/lib/api/errors";
import { createRoomRequestSchema } from "@/lib/api/schemas";
import { enforceRateLimit } from "@/lib/api/server";
import { createRoom } from "@/lib/rooms";

/**
 * POST /api/rooms
 * Luo uuden pelihuoneen. Palauttaa huoneen tunnisteen, PIN-koodin ja
 * juontajan istuntotokenin. Tokenia ei koskaan tallenneta selväkielisenä
 * tietokantaan eikä kirjata lokiin.
 */
export async function POST(request: Request) {
  try {
    enforceRateLimit(request, "rooms:create", 10, 60_000);
    parseWith(createRoomRequestSchema, await readJsonBody(request));

    const room = await createRoom();

    return jsonResponse(room, 201);
  } catch (error) {
    return jsonErrorResponse(error);
  }
}
