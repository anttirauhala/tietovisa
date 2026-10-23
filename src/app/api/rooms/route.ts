import { ApiError, jsonErrorResponse, jsonResponse, parseWith, readJsonBody } from "@/lib/api/errors";
import { passcodeErrorMessage, verifyHostPasscode } from "@/lib/api/hostPasscode";
import { createRoomRequestSchema } from "@/lib/api/schemas";
import { enforceRateLimit } from "@/lib/api/server";
import { getServerEnv } from "@/lib/env";
import { createRoom } from "@/lib/rooms";

/**
 * GET /api/rooms
 * Kertoo, vaatiiko uuden pelin luominen juontajan tunnuslauseen. Näin
 * juontajan sivu osaa näyttää tunnuslausekentän vain tarvittaessa.
 */
export async function GET() {
  try {
    return jsonResponse({ passcodeRequired: Boolean(getServerEnv().HOST_PASSCODE) });
  } catch (error) {
    return jsonErrorResponse(error);
  }
}

/**
 * POST /api/rooms
 * Luo uuden pelihuoneen. Palauttaa huoneen tunnisteen, PIN-koodin ja
 * juontajan istuntotokenin. Tokenia ei koskaan tallenneta selväkielisenä
 * tietokantaan eikä kirjata lokiin.
 *
 * Jos palvelimelle on asetettu HOST_PASSCODE, pyynnön pitää sisältää sama
 * tunnuslause. Muuten luonti on avointa.
 */
export async function POST(request: Request) {
  try {
    // Tiukempi raja kuin ennen: huoneen luonti on raskain yksittäinen toiminto
    // ja ainoa, jonka kuka tahansa voi tehdä ilman istuntoa.
    enforceRateLimit(request, "rooms:create", 5, 60_000);
    enforceRateLimit(request, "rooms:create:hour", 20, 3_600_000);

    const body = parseWith(createRoomRequestSchema, await readJsonBody(request));

    const check = verifyHostPasscode(body.passcode, getServerEnv().HOST_PASSCODE);
    if (!check.ok) {
      throw new ApiError(401, "invalid_token", passcodeErrorMessage(check.reason));
    }

    const room = await createRoom();

    return jsonResponse(room, 201);
  } catch (error) {
    return jsonErrorResponse(error);
  }
}
