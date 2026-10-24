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
    /*
     * Koko pikkujouluseurue liittyy yleensä samasta WiFi-verkosta, jolloin
     * kaikki jakavat saman julkisen IP-osoitteen. Siksi rajan pitää riittää
     * koko seurueelle yhdessä minuutissa – 20/min estäisi osan vieraista
     * liittymästä, kun QR-koodi näytetään kerralla kaikille.
     *
     * 60/min riittää isollekin seurueelle ja hidastaa silti PIN-koodin
     * arvaamista (kuusinumeroinen avaruus on miljoona yhdistelmää).
     */
    enforceRateLimit(request, "rooms:join", 60, 60_000);

    const body = parseWith(joinRoomRequestSchema, await readJsonBody(request));
    const result = await joinRoom(body.pin, body.nickname);

    return jsonResponse(result, 201);
  } catch (error) {
    return jsonErrorResponse(error);
  }
}
