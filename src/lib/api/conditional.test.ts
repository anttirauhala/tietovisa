import { describe, expect, it } from "vitest";

import { jsonStateResponse } from "./conditional";

/**
 * Ehdollisen tilavastauksen testit (vaihe 2b).
 *
 * Testit käyttävät oikeaa Request- ja Response-oliota, joten ETag-otsikko,
 * 304-tila ja tyhjä runko tulevat todennetuiksi sellaisina kuin selain ne
 * näkisi – ilman että tarvitaan käynnissä olevaa Supabase-projektia.
 */

function stateRequest(ifNoneMatch?: string): Request {
  const headers = new Headers();
  if (ifNoneMatch) {
    headers.set("if-none-match", ifNoneMatch);
  }
  return new Request("https://visa.example.com/api/rooms/abc/state", { headers });
}

const state = {
  role: "player",
  serverNow: "2026-01-01T12:00:00.000Z",
  room: { status: "question", answerCount: 1 },
  players: [],
  me: { rank: 1, score: 500 },
};

describe("jsonStateResponse", () => {
  it("palauttaa tilan ja ETag-otsikon ilman ehdollista otsikkoa", async () => {
    const response = jsonStateResponse(stateRequest(), state);

    expect(response.status).toBe(200);
    expect(response.headers.get("etag")).toMatch(/^W\/"[A-Za-z0-9_-]{22}"$/);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.json()).toEqual(state);
  });

  it("vastaa 304 ilman runkoa, kun tila on ennallaan", async () => {
    const first = jsonStateResponse(stateRequest(), state);
    const etag = first.headers.get("etag");
    expect(etag).not.toBeNull();

    const second = jsonStateResponse(stateRequest(etag ?? undefined), state);

    expect(second.status).toBe(304);
    expect(second.headers.get("etag")).toBe(etag);
    expect(await second.text()).toBe("");
  });

  it("vastaa täyden tilan, kun ETag ei täsmää", async () => {
    const response = jsonStateResponse(stateRequest('W/"vanhentunut"'), state);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(state);
  });

  it("ei muuta ETagia serverNow-kellon muuttuessa", () => {
    const later = { ...state, serverNow: "2026-01-01T12:00:01.000Z" };

    expect(jsonStateResponse(stateRequest(), later).headers.get("etag")).toBe(
      jsonStateResponse(stateRequest(), state).headers.get("etag"),
    );
  });

  it("muuttaa ETagia, kun pelin tila muuttuu", () => {
    const changed = { ...state, room: { status: "leaderboard", answerCount: 1 } };

    expect(jsonStateResponse(stateRequest(), changed).headers.get("etag")).not.toBe(
      jsonStateResponse(stateRequest(), state).headers.get("etag"),
    );
  });
});
