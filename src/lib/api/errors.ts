import { z } from "zod";

/**
 * Yhtenäinen API-virheiden käsittely.
 *
 * Virhevastaukset eivät koskaan sisällä salaisuuksia, SQL-virheitä eikä
 * palvelimen sisäisiä tietoja – vain koneellisen koodin ja suomenkielisen viestin.
 */

export type ApiErrorBody = {
  error: {
    code: string;
    message: string;
  };
};

export const API_ERROR_MESSAGES: Record<string, string> = {
  invalid_request: "Pyyntö oli virheellinen.",
  invalid_token: "Istunto ei ole kelvollinen. Liity peliin uudelleen.",
  forbidden: "Sinulla ei ole oikeutta tähän toimintoon.",
  not_found: "Pelihuonetta ei löytynyt.",
  invalid_state: "Toiminto ei ole sallittu pelin nykyisessä vaiheessa.",
  too_early: "Kysymys on vielä kesken.",
  late: "Aika ehti loppua.",
  conflict: "Toiminto on jo tehty.",
  rate_limited: "Liian monta pyyntöä. Yritä hetken kuluttua uudelleen.",
  not_configured: "Palvelimen Supabase-asetukset puuttuvat.",
  server_error: "Palvelimella tapahtui virhe. Yritä uudelleen.",
};

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message?: string,
  ) {
    super(message ?? API_ERROR_MESSAGES[code] ?? API_ERROR_MESSAGES.server_error);
    this.name = "ApiError";
  }
}

export function jsonResponse(data: unknown, status = 200): Response {
  return Response.json(data, {
    status,
    headers: { "cache-control": "no-store" },
  });
}

export function jsonErrorResponse(error: unknown): Response {
  if (error instanceof ApiError) {
    return Response.json(
      { error: { code: error.code, message: error.message } } satisfies ApiErrorBody,
      { status: error.status, headers: { "cache-control": "no-store" } },
    );
  }

  if (error instanceof z.ZodError) {
    const first = error.issues[0];
    return Response.json(
      {
        error: {
          code: "invalid_request",
          message: first?.message ?? API_ERROR_MESSAGES.invalid_request,
        },
      } satisfies ApiErrorBody,
      { status: 400, headers: { "cache-control": "no-store" } },
    );
  }

  // Palvelimen sisäinen virhe: kirjataan palvelimelle, mutta ei paljasteta
  // yksityiskohtia selaimelle. Tokenit ja avaimet eivät päädy tänne.
  console.error("[tietovisa] odottamaton virhe:", error instanceof Error ? error.message : error);

  return Response.json(
    { error: { code: "server_error", message: API_ERROR_MESSAGES.server_error } } satisfies ApiErrorBody,
    { status: 500, headers: { "cache-control": "no-store" } },
  );
}

export async function readJsonBody(request: Request): Promise<unknown> {
  try {
    const text = await request.text();
    if (text.trim().length === 0) {
      return {};
    }
    return JSON.parse(text);
  } catch {
    throw new ApiError(400, "invalid_request", "Pyynnön runko ei ole kelvollista JSONia.");
  }
}

export function parseWith<T>(schema: z.ZodType<T>, input: unknown): T {
  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    throw new ApiError(
      400,
      "invalid_request",
      parsed.error.issues[0]?.message ?? API_ERROR_MESSAGES.invalid_request,
    );
  }
  return parsed.data;
}

/** RPC-funktioiden tilakoodit → API-virheet. */
export function apiErrorFromRpcStatus(status: string): ApiError {
  switch (status) {
    case "room_not_found":
      return new ApiError(404, "not_found", "Pelihuonetta ei löytynyt.");
    case "player_not_found":
      return new ApiError(401, "invalid_token", "Pelaajaa ei löytynyt tästä huoneesta.");
    case "forbidden":
      return new ApiError(403, "forbidden", API_ERROR_MESSAGES.forbidden);
    case "invalid_state":
      return new ApiError(409, "invalid_state", API_ERROR_MESSAGES.invalid_state);
    case "too_early":
      return new ApiError(409, "too_early", API_ERROR_MESSAGES.too_early);
    case "late":
      return new ApiError(409, "late", API_ERROR_MESSAGES.late);
    case "closed":
      return new ApiError(409, "invalid_state", "Vastausten vastaanotto on päättynyt.");
    case "wrong_question":
      return new ApiError(409, "invalid_state", "Vastasit väärään kysymykseen.");
    case "already_answered":
      return new ApiError(409, "conflict", "Olet jo vastannut tähän kysymykseen.");
    case "nickname_taken":
      return new ApiError(409, "conflict", "Nimimerkki on jo käytössä tässä pelissä.");
    case "room_full":
      return new ApiError(409, "conflict", "Pelihuone on täynnä.");
    case "already_started":
      return new ApiError(409, "conflict", "Peli on jo alkanut, et voi enää liittyä.");
    case "invalid_answer_index":
      return new ApiError(400, "invalid_request", "Virheellinen vastausvaihtoehto.");
    default:
      return new ApiError(400, "invalid_request");
  }
}
