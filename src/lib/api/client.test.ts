import { afterEach, describe, expect, it, vi } from "vitest";

import { apiConditionalRequest, apiRequest } from "./client";

/**
 * Selainpuolen API-apurin testit (vaiheet 2b ja virheiden käsittely).
 *
 * `fetch` korvataan testikohtaisesti, joten testit todentavat otsikot ja
 * 304-käsittelyn ilman käynnissä olevaa palvelinta.
 */

function jsonResponse(body: unknown, init: { status?: number; etag?: string } = {}): Response {
  const headers = new Headers({ "content-type": "application/json" });
  if (init.etag) {
    headers.set("etag", init.etag);
  }
  return new Response(JSON.stringify(body), { status: init.status ?? 200, headers });
}

function stubFetch(handler: (init?: RequestInit) => Response | Promise<Response>) {
  let capturedInit: RequestInit | undefined;

  vi.stubGlobal("fetch", async (_input: unknown, init?: RequestInit) => {
    capturedInit = init;
    return handler(init);
  });

  return () => capturedInit;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("apiConditionalRequest", () => {
  it("lähettää If-None-Match-otsikon ja palauttaa tilan ETagin kanssa", async () => {
    const captured = stubFetch(() => jsonResponse({ room: { status: "lobby" } }, { etag: 'W/"abc"' }));

    const result = await apiConditionalRequest<{ room: { status: string } }>("/api/x", {
      etag: 'W/"vanha"',
    });

    const headers = captured()?.headers as Headers;
    expect(headers.get("if-none-match")).toBe('W/"vanha"');
    expect(result).toEqual({
      ok: true,
      notModified: false,
      data: { room: { status: "lobby" } },
      etag: 'W/"abc"',
    });
  });

  it("ei lähetä If-None-Match-otsikkoa ilman ETagia", async () => {
    const captured = stubFetch(() => jsonResponse({ ok: true }));

    await apiConditionalRequest("/api/x");

    const headers = captured()?.headers as Headers;
    expect(headers.get("if-none-match")).toBeNull();
  });

  it("tulkitsee 304-vastauksen muuttumattomaksi tilaksi", async () => {
    stubFetch(() => new Response(null, { status: 304, headers: { etag: 'W/"abc"' } }));

    const result = await apiConditionalRequest("/api/x", { etag: 'W/"abc"' });

    expect(result).toEqual({ ok: true, notModified: true, etag: 'W/"abc"' });
  });

  it("palauttaa virheen ennallaan myös ehdollisessa kyselyssä", async () => {
    stubFetch(() =>
      jsonResponse({ error: { code: "invalid_token", message: "Istunto ei ole kelvollinen." } }, {
        status: 401,
      }),
    );

    const result = await apiConditionalRequest("/api/x");

    expect(result).toEqual({
      ok: false,
      status: 401,
      code: "invalid_token",
      message: "Istunto ei ole kelvollinen.",
    });
  });
});

describe("apiRequest", () => {
  it("palauttaa palvelimen virheilmoituksen sellaisenaan", async () => {
    stubFetch(() =>
      jsonResponse({ error: { code: "invalid_state", message: "Ei sallittu nyt." } }, { status: 409 }),
    );

    const result = await apiRequest("/api/x");

    expect(result).toEqual({
      ok: false,
      status: 409,
      code: "invalid_state",
      message: "Ei sallittu nyt.",
    });
  });

  it("käsittelee odottamattoman 304-vastauksen selkeänä virheenä", async () => {
    stubFetch(() => new Response(null, { status: 304 }));

    const result = await apiRequest("/api/x");

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("not_modified");
    }
  });
});
