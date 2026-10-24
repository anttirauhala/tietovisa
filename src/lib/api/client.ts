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

/**
 * Ehdollisen tilakyselyn tulos (vaihe 2b).
 *
 * `notModified: true` tarkoittaa, että palvelin vastasi 304 Not Modified:
 * tila on ennallaan eikä runkoa siirretty. Silloin selaimen pitää säilyttää
 * aiempi tilansa sellaisenaan.
 */
export type ApiConditionalSuccess<T> = {
  ok: true;
  notModified: false;
  data: T;
  etag: string | null;
};

export type ApiNotModified = {
  ok: true;
  notModified: true;
  etag: string | null;
};

export type ApiConditionalResult<T> = ApiConditionalSuccess<T> | ApiNotModified | ApiFailure;

export type ApiRequestOptions = {
  method?: "GET" | "POST";
  json?: unknown;
  hostToken?: string | null;
  playerToken?: string | null;
  /**
   * Aiemman vastauksen ETag. Kun se annetaan, pyyntöön lisätään
   * If-None-Match ja palvelin voi vastata 304:llä ilman runkoa.
   */
  etag?: string | null;
  signal?: AbortSignal;
};

const NETWORK_ERROR_MESSAGE =
  "Yhteys palvelimeen katkesi. Tarkista verkkoyhteys ja yritä uudelleen.";

/** Pyynnön raakatulos: ehdollisuus ratkaistaan vasta julkisissa funktioissa. */
type RawRequestResult<T> =
  | { ok: true; notModified: boolean; data: T | null; etag: string | null }
  | ApiFailure;

async function performRequest<T>(
  path: string,
  options: ApiRequestOptions,
): Promise<RawRequestResult<T>> {
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
  // Ehdollinen kysely: palvelin vastaa 304:llä, jos tila on ennallaan.
  if (options.etag) {
    headers.set("if-none-match", options.etag);
  }

  try {
    const response = await fetch(path, {
      method: options.method ?? "GET",
      headers,
      body: options.json === undefined ? undefined : JSON.stringify(options.json),
      signal: options.signal,
      cache: "no-store",
    });

    const etag = response.headers.get("etag");

    // 304 Not Modified: runkoa ei ole ja tila säilyy selaimessa ennallaan.
    if (response.status === 304) {
      return { ok: true, notModified: true, data: null, etag };
    }

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

    return { ok: true, notModified: false, data: payload as T, etag };
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      return { ok: false, status: 0, code: "aborted", message: "Pyyntö peruutettiin." };
    }
    return { ok: false, status: 0, code: "network_error", message: NETWORK_ERROR_MESSAGE };
  }
}

/** Tavallinen pyyntö: vastaus on aina runko. */
export async function apiRequest<T>(
  path: string,
  options: ApiRequestOptions = {},
): Promise<ApiResult<T>> {
  const result = await performRequest<T>(path, options);

  if (!result.ok) {
    return result;
  }

  if (result.notModified) {
    // 304 saapuu vain, jos pyyntöön lisättiin If-None-Match. apiRequest ei
    // tee sitä, joten tähän ei pitäisi päätyä – palautetaan silti selkeä virhe.
    return { ok: false, status: 304, code: "not_modified", message: "Tila on ennallaan." };
  }

  return { ok: true, data: result.data as T };
}

/**
 * Ehdollinen tilakysely: palvelin voi vastata 304:llä, jolloin tila on
 * ennallaan eikä runkoa tarvitse käsitellä uudelleen.
 */
export async function apiConditionalRequest<T>(
  path: string,
  options: ApiRequestOptions = {},
): Promise<ApiConditionalResult<T>> {
  const result = await performRequest<T>(path, options);

  if (!result.ok) {
    return result;
  }

  if (result.notModified) {
    return { ok: true, notModified: true, etag: result.etag };
  }

  return { ok: true, notModified: false, data: result.data as T, etag: result.etag };
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
