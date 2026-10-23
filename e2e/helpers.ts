import { readFileSync } from "node:fs";
import path from "node:path";

import { devices, type Browser, type BrowserContext } from "@playwright/test";

/**
 * Selaintason testien apurit.
 *
 * Testit käyttävät oikeaa Supabase-projektia (samat ympäristömuuttujat kuin
 * sovellus lukee .env.local-tiedostosta). Jokainen testi luo oman pelihuoneensa
 * ja siivoaa sen lopuksi.
 *
 * Pelaajat testataan erillisillä selainkonteksteilla, joten jokaisella on oma
 * localStorage-tallennuksensa – aivan kuten oikeilla puhelimilla.
 */

const ENV_FILE = path.join(process.cwd(), ".env.local");
const QUESTIONS_FILE = path.join(process.cwd(), "src", "data", "questions.json");

export type Question = {
  id: string;
  category: string;
  question: string;
  answers: string[];
  correctAnswerIndex: number;
  timeLimitSeconds: number;
  points: number;
};

export function readQuestions(): Question[] {
  return JSON.parse(readFileSync(QUESTIONS_FILE, "utf8")) as Question[];
}

function readEnv(): Record<string, string> {
  const env: Record<string, string> = {};
  for (const line of readFileSync(ENV_FILE, "utf8").split("\n")) {
    const match = /^\s*(?:export\s+)?([A-Z0-9_]+)\s*=\s*(.+)$/.exec(line);
    if (match) {
      env[match[1]] = match[2].trim().replace(/^["']|["']$/g, "");
    }
  }
  return env;
}

export type RoomFixture = { roomId: string; pin: string; hostToken: string };

export type PlayerFixture = {
  playerId: string;
  roomId: string;
  nickname: string;
  playerToken: string;
};

const createdRooms: string[] = [];

export async function createRoom(baseURL: string): Promise<RoomFixture> {
  const response = await fetch(`${baseURL}/api/rooms`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: "{}",
  });

  if (!response.ok) {
    throw new Error(`Huoneen luonti epäonnistui: ${response.status}`);
  }

  const room = (await response.json()) as RoomFixture;
  createdRooms.push(room.roomId);
  return room;
}

export async function joinPlayer(
  baseURL: string,
  pin: string,
  nickname: string,
): Promise<PlayerFixture> {
  const response = await fetch(`${baseURL}/api/rooms/join`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ pin, nickname }),
  });

  if (!response.ok) {
    throw new Error(`Liittyminen epäonnistui: ${response.status} ${await response.text()}`);
  }

  return (await response.json()) as PlayerFixture;
}

/** Asettaa istunnon selainkontekstiin ennen sivun latausta (kuten localStorage). */
export async function seedHostSession(
  context: BrowserContext,
  room: RoomFixture,
): Promise<void> {
  await context.addInitScript((session: unknown) => {
    window.localStorage.setItem("tietovisa:host-session", JSON.stringify(session));
  }, { ...room, createdAt: new Date().toISOString() });
}

export async function seedPlayerSession(
  context: BrowserContext,
  player: PlayerFixture,
): Promise<void> {
  await context.addInitScript((session: unknown) => {
    window.localStorage.setItem("tietovisa:player-session", JSON.stringify(session));
  }, { ...player, createdAt: new Date().toISOString() });
}

/** Uusi puhelinta jäljittelevä selainkonteksti (oma localStorage). */
export async function mobileContext(browser: Browser): Promise<BrowserContext> {
  return browser.newContext({ ...devices["Pixel 5"], locale: "fi-FI" });
}

/**
 * Testifixture: asettaa huoneen tilan suoraan kantaan palvelinavaimella.
 * Käytetään vain testien nopeuttamiseen (esim. kysymyksen määräajan
 * siirtäminen menneisyyteen), ei kiertämään sovelluksen logiikkaa.
 */
export async function patchRoom(
  roomId: string,
  patch: Record<string, unknown>,
): Promise<void> {
  const env = readEnv();
  const response = await fetch(
    `${env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/rooms?id=eq.${roomId}`,
    {
      method: "PATCH",
      headers: {
        apikey: env.SUPABASE_SERVICE_ROLE_KEY,
        authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
        "content-type": "application/json",
        prefer: "return=minimal",
      },
      body: JSON.stringify(patch),
    },
  );

  if (!response.ok) {
    throw new Error(`Huoneen tilan asetus epäonnistui: ${response.status}`);
  }
}

export async function patchPlayer(
  playerId: string,
  patch: Record<string, unknown>,
): Promise<void> {
  const env = readEnv();
  const response = await fetch(
    `${env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/players?id=eq.${playerId}`,
    {
      method: "PATCH",
      headers: {
        apikey: env.SUPABASE_SERVICE_ROLE_KEY,
        authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
        "content-type": "application/json",
        prefer: "return=minimal",
      },
      body: JSON.stringify(patch),
    },
  );

  if (!response.ok) {
    throw new Error(`Pelaajan päivitys epäonnistui: ${response.status}`);
  }
}

/** Siivoaa testien luomat huoneet (poistaa myös pelaajat ja vastaukset). */
export async function cleanupRooms(): Promise<void> {
  const env = readEnv();

  for (const roomId of createdRooms.splice(0)) {
    await fetch(`${env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/rooms?id=eq.${roomId}`, {
      method: "DELETE",
      headers: {
        apikey: env.SUPABASE_SERVICE_ROLE_KEY,
        authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
      },
    });
  }
}
