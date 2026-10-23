import "server-only";

import { createHash, randomInt, timingSafeEqual } from "node:crypto";

/**
 * Istuntotokenit ja PIN-koodit.
 *
 * - Tokenit luodaan kryptografisesti turvallisella satunnaisuudella.
 * - Tietokantaan tallennetaan vain SHA-256-tiiviste, ei koskaan selväkielistä tokenia.
 * - Vertailu tehdään vakiomuotoisella (vakioaikaisella) vertailulla.
 */

const TOKEN_BYTES = 32;

/** 43 merkin base64url-token, jossa on 256 bittiä satunnaisuutta. */
export function createSessionToken(): string {
  const bytes = new Uint8Array(TOKEN_BYTES);
  for (let i = 0; i < bytes.length; i += 1) {
    bytes[i] = randomInt(0, 256);
  }
  return Buffer.from(bytes).toString("base64url");
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

export function hashesEqual(a: string | null | undefined, b: string | null | undefined): boolean {
  if (!a || !b) {
    return false;
  }
  const bufferA = Buffer.from(a, "utf8");
  const bufferB = Buffer.from(b, "utf8");
  if (bufferA.length !== bufferB.length) {
    return false;
  }
  return timingSafeEqual(bufferA, bufferB);
}

/** Kuusinumeroinen liittymiskoodi ilman modulo-harhaa. */
export function createRoomPin(): string {
  return String(randomInt(0, 1_000_000)).padStart(6, "0");
}

/** Onko token muodollisesti kelvollinen (pituus ja merkistö). */
export function isWellFormedToken(token: unknown): token is string {
  return typeof token === "string" && /^[A-Za-z0-9_-]{43}$/.test(token);
}

/** Onko PIN-koodi muodollisesti kelvollinen. */
export function isWellFormedPin(pin: unknown): pin is string {
  return typeof pin === "string" && /^[0-9]{6}$/.test(pin);
}
