/**
 * Pelin istuntojen säilytys selaimessa.
 *
 * Tokenit pidetään localStoragessa eivätkä koskaan URL-osoitteessa.
 * Jos istunto katoaa, käyttäjä ohjataan liittymään uudelleen – pisteitä ei
 * voi manipuloida, koska pisteet lasketaan aina palvelimella.
 */

const HOST_KEY = "tietovisa:host-session";
const PLAYER_KEY = "tietovisa:player-session";

/** Tallennusavaimet (käytetään myös useSyncExternalStore-pohjaisissa hookeissa). */
export const HOST_SESSION_STORAGE_KEY = HOST_KEY;
export const PLAYER_SESSION_STORAGE_KEY = PLAYER_KEY;

export type HostSession = {
  roomId: string;
  pin: string;
  hostToken: string;
  createdAt: string;
};

export type PlayerSession = {
  playerId: string;
  roomId: string;
  nickname: string;
  playerToken: string;
  createdAt: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function readJson(key: string): Record<string, unknown> | null {
  if (typeof window === "undefined") {
    return null;
  }
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) {
      return null;
    }
    const parsed: unknown = JSON.parse(raw);
    return isRecord(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function writeJson(key: string, value: unknown): void {
  if (typeof window === "undefined") {
    return;
  }
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Yksityinen selaus tai täysi tallennustila: ei kaadeta sovellusta.
  }
}

function remove(key: string): void {
  if (typeof window === "undefined") {
    return;
  }
  try {
    window.localStorage.removeItem(key);
  } catch {
    // ei toimenpiteitä
  }
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

export function saveHostSession(session: HostSession): void {
  writeJson(HOST_KEY, session);
}

export function loadHostSession(): HostSession | null {
  const raw = readJson(HOST_KEY);
  if (!raw) {
    return null;
  }
  const roomId = asString(raw.roomId);
  const pin = asString(raw.pin);
  const hostToken = asString(raw.hostToken);
  if (!roomId || !pin || !hostToken) {
    return null;
  }
  return {
    roomId,
    pin,
    hostToken,
    createdAt: asString(raw.createdAt) ?? new Date().toISOString(),
  };
}

export function clearHostSession(): void {
  remove(HOST_KEY);
}

export function savePlayerSession(session: PlayerSession): void {
  writeJson(PLAYER_KEY, session);
}

export function loadPlayerSession(): PlayerSession | null {
  const raw = readJson(PLAYER_KEY);
  if (!raw) {
    return null;
  }
  const playerId = asString(raw.playerId);
  const roomId = asString(raw.roomId);
  const nickname = asString(raw.nickname);
  const playerToken = asString(raw.playerToken);
  if (!playerId || !roomId || !nickname || !playerToken) {
    return null;
  }
  return {
    playerId,
    roomId,
    nickname,
    playerToken,
    createdAt: asString(raw.createdAt) ?? new Date().toISOString(),
  };
}

export function clearPlayerSession(): void {
  remove(PLAYER_KEY);
}
