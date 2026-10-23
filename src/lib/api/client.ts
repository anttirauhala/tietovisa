/**
 * Selainpuolen API-apuri.
 *
 * Kaikki pelitoiminnot kulkevat palvelinpuolen route handlerien kautta.
 * Tokenit lähetetään otsikoissa (x-host-token / x-player-token), jotta ne
 * eivät päädy URL-osoitteeseen, selaimen historiaan tai palvelinlokeihin.
 */

export type ApiFailure = {
  ok: false;
  status: number;
  code: string;
  message: string;
};

export type ApiSuccess<T> = {
  ok: true;
  data: T;
};

export type ApiResult<T> = ApiSuccess<T> | ApiFailure;

export type ApiRequestOptions = {
  method?: "GET" | "POST";
  json?: unknown;
  hostToken?: string | null;
  playerToken?: string | null;
  signal?: AbortSignal;
};

const NETWORK_ERROR_MESSAGE =
  "Yhteys palvelimeen katkesi. Tarkista verkkoyhteys ja yritä uudelleen.";

export async function apiRequest<T>(
  path: string,
  options: ApiRequestOptions = {},
): Promise<ApiResult<T>> {
  const headers = new Headers({ accept: "application/json" });

  if (options.json !== undefined) {
    headers.set("content-type", "application/json");
  }
  if (options.hostToken) {
    headers.set("x-host-token", options.hostToken);
  }
  if (options.playerToken) {
    headers.set("x-player-token", options.playerToken);
  }

  try {
    const response = await fetch(path, {
      method: options.method ?? "GET",
      headers,
      body: options.json === undefined ? undefined : JSON.stringify(options.json),
      signal: options.signal,
      cache: "no-store",
    });

    const text = await response.text();
    const payload: unknown = text.length > 0 ? safeJsonParse(text) : null;

    if (!response.ok) {
      return {
        ok: false,
        status: response.status,
        code: readErrorCode(payload) ?? "server_error",
        message: readErrorMessage(payload) ?? "Toiminto ei onnistunut. Yritä uudelleen.",
      };
    }

    return { ok: true, data: payload as T };
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      return { ok: false, status: 0, code: "aborted", message: "Pyyntö peruutettiin." };
    }
    return { ok: false, status: 0, code: "network_error", message: NETWORK_ERROR_MESSAGE };
  }
}

function safeJsonParse(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function readErrorCode(payload: unknown): string | null {
  if (typeof payload === "object" && payload !== null && "error" in payload) {
    const error = (payload as { error?: unknown }).error;
    if (typeof error === "object" && error !== null && "code" in error) {
      const code = (error as { code?: unknown }).code;
      if (typeof code === "string") {
        return code;
      }
    }
  }
  return null;
}

function readErrorMessage(payload: unknown): string | null {
  if (typeof payload === "object" && payload !== null && "error" in payload) {
    const error = (payload as { error?: unknown }).error;
    if (typeof error === "object" && error !== null && "message" in error) {
      const message = (error as { message?: unknown }).message;
      if (typeof message === "string" && message.length > 0) {
        return message;
      }
    }
  }
  return null;
}
