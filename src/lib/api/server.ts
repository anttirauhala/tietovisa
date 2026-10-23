import "server-only";

import { ApiError } from "@/lib/api/errors";
import { checkRateLimit, getClientKey } from "@/lib/rateLimit";

/** Palvelinpuolen apurit route handlereille. */

export function readHostToken(request: Request): string | null {
  return request.headers.get("x-host-token");
}

export function readPlayerToken(request: Request): string | null {
  return request.headers.get("x-player-token");
}

export function requireHostToken(request: Request): string {
  const token = readHostToken(request);
  if (!token) {
    throw new ApiError(401, "invalid_token", "Juontajan istunto puuttuu.");
  }
  return token;
}

export function requirePlayerToken(request: Request): string {
  const token = readPlayerToken(request);
  if (!token) {
    throw new ApiError(401, "invalid_token", "Pelaajan istunto puuttuu.");
  }
  return token;
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Tarkistaa reittiparametrina saadun huoneen tunnisteen muodon. */
export function assertRoomId(roomId: string): string {
  if (!UUID_PATTERN.test(roomId)) {
    throw new ApiError(404, "not_found", "Pelihuonetta ei löytynyt.");
  }
  return roomId;
}

export function enforceRateLimit(
  request: Request,
  scope: string,
  limit: number,
  windowMs: number,
): void {
  const result = checkRateLimit(getClientKey(request, scope), limit, windowMs);

  if (!result.allowed) {
    throw new ApiError(
      429,
      "rate_limited",
      `Liian monta pyyntöä. Yritä uudelleen noin ${result.retryAfterSeconds} sekunnin kuluttua.`,
    );
  }
}
