import {
  jsonErrorResponse,
  jsonResponse,
  parseWith,
  readJsonBody,
} from "@/lib/api/errors";
import { joinRoomRequestSchema } from "@/lib/api/schemas";
import { enforceRateLimit } from "@/lib/api/server";
import { JOIN_RATE_LIMIT_PER_MINUTE } from "@/lib/api/rateLimitPolicy";
import { joinRoom } from "@/lib/rooms";

/**
 * POST /api/rooms/join
 * Liittää pelaajan huoneeseen PIN-koodilla. PIN-koodi ei ole salaisuus:
 * käyttöoikeus perustuu erilliseen satunnaiseen istuntotokeniin.
 */
export async function POST(request: Request) {
  try {
    /*
     * Pelaajat liittyvät omilla puhelimillaan mobiiliverkosta. IPv6:ssa
     * jokaisella laitteella on yleensä oma julkinen osoite, mutta operaattorin
     * CGNAT voi näyttää usean liittyjän samana IPv4-osoitteena, eikä rajoitin
     * voi erottaa seuruetta muista saman osoitteen käyttäjistä. Siksi rajan
     * pitää riittää koko seurueelle yhdessä minuutissa – 20/min estäisi osan
     * vieraista liittymästä, kun QR-koodi näytetään kerralla kaikille.
     *
     * 250/min on mitoitettu tietokannan pelaajakaton mukaan: join_room
     * hyväksyy huoneeseen enintään 200 pelaajaa, joten koko seurueen pitää
     * voida liittyä saman minuutin aikana. 75 pelaajan pikkujoulu käyttää
     * rajasta noin 30 % ja täysi 200 pelaajan huone noin 80 %, joten
     * normaali liittyminen ei voi törmätä rajaan myöskään silloin, kun osa
     * vieraista yrittää uudelleen esimerkiksi nimimerkkitörmäyksen jälkeen.
     *
     * PIN-koodin arvaaminen hidastuu silti selvästi (kuusinumeroinen avaruus
     * on miljoona yhdistelmää), eikä liittymisreittiä voi käyttää
     * tietokannan kuormittamiseen.
     */
    enforceRateLimit(request, "rooms:join", JOIN_RATE_LIMIT_PER_MINUTE, 60_000);

    const body = parseWith(joinRoomRequestSchema, await readJsonBody(request));
    const result = await joinRoom(body.pin, body.nickname);

    return jsonResponse(result, 201);
  } catch (error) {
    return jsonErrorResponse(error);
  }
}
