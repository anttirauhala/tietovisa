import "server-only";

import { ApiError, apiErrorFromRpcStatus } from "@/lib/api/errors";
import { getQuestionTimeLimitMs, hasQuestionAt } from "@/lib/questions";
import { loadRoomSnapshot } from "@/lib/roomState";
import { mapDatabaseError } from "@/lib/supabase/errors";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { createRoomPin, createSessionToken, hashToken } from "@/lib/tokens";

/**
 * Huoneen elinkaari ja pelin ohjaus palvelimella.
 *
 * Jokainen tilasiirtymä tapahtuu tietokannan RPC-funktiossa, joka lukitsee
 * huonerivin (SELECT ... FOR UPDATE). Näin kaksi nopeaa komentoa eivät voi
 * hypätä kysymysten yli eivätkä palkita pelaajia kahdesti.
 */

const PIN_ATTEMPTS = 10;

/**
 * Kuinka vanhat huoneet siivotaan pois uuden huoneen luonnin yhteydessä.
 * Huoneen luonti on ainoa kohta, jossa syntyy uutta dataa ilman istuntoa,
 * joten siivous on luontevaa tehdä siinä – erillistä ajastettua tehtävää
 * tai taustapalvelua ei tarvita.
 */
const PURGE_OLDER_THAN_HOURS = 24;

type RpcPayload = Record<string, unknown>;

function isRecord(value: unknown): value is RpcPayload {
  return typeof value === "object" && value !== null;
}

/** Poistaa vanhentuneet huoneet. Parasta yritystä: ei kaada huoneen luontia. */
async function purgeOldRooms(): Promise<void> {
  try {
    const { error } = await getSupabaseAdmin().rpc("purge_old_rooms", {
      p_older_than_hours: PURGE_OLDER_THAN_HOURS,
    });

    if (error) {
      // Ei kirjata virhettä käyttäjälle: siivous ei ole kriittinen toimenpide.
      console.warn("[tietovisa] vanhojen huoneiden siivous ohitettiin:", error.code ?? "tuntematon");
    }
  } catch {
    // Verkkoyhteys tms. – jatketaan huoneen luontia.
  }
}

async function callRpc(functionName: string, params: RpcPayload): Promise<RpcPayload> {
  const { data, error } = await getSupabaseAdmin().rpc(functionName, params);

  if (error) {
    throw mapDatabaseError(error);
  }

  if (!isRecord(data)) {
    throw new ApiError(500, "server_error");
  }

  return data;
}

function requireOk(payload: RpcPayload): RpcPayload {
  const status = typeof payload.status === "string" ? payload.status : "server_error";
  if (status !== "ok") {
    throw apiErrorFromRpcStatus(status);
  }
  return payload;
}

/** Luo uuden pelihuoneen. PIN-koodin törmäys ei jää pysyväksi esteeksi. */
export async function createRoom(): Promise<{ roomId: string; pin: string; hostToken: string }> {
  const hostToken = createSessionToken();
  const hostTokenHash = hashToken(hostToken);

  await purgeOldRooms();

  for (let attempt = 0; attempt < PIN_ATTEMPTS; attempt += 1) {
    const pin = createRoomPin();
    const { data, error } = await getSupabaseAdmin().rpc("create_room", {
      p_pin: pin,
      p_host_token_hash: hostTokenHash,
    });

    if (!error) {
      if (typeof data !== "string") {
        throw new ApiError(500, "server_error");
      }
      return { roomId: data, pin, hostToken };
    }

    // 23505 = unique_violation: PIN ehti varata kilpailevassa pyynnössä.
    if (error.code === "23505") {
      continue;
    }

    throw mapDatabaseError(error);
  }

  throw new ApiError(503, "server_error", "Liittymiskoodia ei saatu luotua. Yritä uudelleen.");
}

export type JoinResult = {
  playerId: string;
  roomId: string;
  nickname: string;
  playerToken: string;
};

export async function joinRoom(pin: string, nickname: string): Promise<JoinResult> {
  const playerToken = createSessionToken();

  const payload = await callRpc("join_room", {
    p_pin: pin,
    p_nickname: nickname,
    p_token_hash: hashToken(playerToken),
  });

  requireOk(payload);

  return {
    playerId: String(payload.playerId),
    roomId: String(payload.roomId),
    nickname: String(payload.nickname),
    playerToken,
  };
}

async function startQuestion(
  roomId: string,
  hostTokenHash: string,
  questionIndex: number,
): Promise<void> {
  const startedAtMs = Date.now();
  const endsAtMs = startedAtMs + getQuestionTimeLimitMs(questionIndex);

  const payload = await callRpc("start_question", {
    p_room_id: roomId,
    p_host_token_hash: hostTokenHash,
    p_question_index: questionIndex,
    p_started_at: new Date(startedAtMs).toISOString(),
    p_ends_at: new Date(endsAtMs).toISOString(),
  });

  requireOk(payload);
}

/** lobby → question (ensimmäinen kysymys). */
export async function startFirstQuestion(roomId: string, hostTokenHash: string): Promise<void> {
  await startQuestion(roomId, hostTokenHash, 0);
}

/** question → question_result. Palvelin tarkistaa, että määräaika on kulunut. */
export async function revealQuestion(roomId: string, hostTokenHash: string): Promise<void> {
  const payload = await callRpc("reveal_question", {
    p_room_id: roomId,
    p_host_token_hash: hostTokenHash,
    p_server_now: new Date().toISOString(),
  });

  requireOk(payload);
}

/**
 * Päättää käynnissä olevan kysymyksen heti siirtämällä määräajan nykyhetkeen.
 * Tavallinen tulosvaiheen siirtymä tehdään tämän jälkeen revealQuestion-
 * funktiolla, joten tilakone pysyy ennallaan.
 *
 * Tarvitaan, jotta juontaja voi keskeyttää kysymyksen (puheenvuoro,
 * aikataulu), sen sijaan että odottaisi aina täyden aikarajan.
 */
export async function endQuestionNow(roomId: string, hostTokenHash: string): Promise<void> {
  const payload = await callRpc("end_question_now", {
    p_room_id: roomId,
    p_host_token_hash: hostTokenHash,
    p_server_now: new Date().toISOString(),
  });

  requireOk(payload);
}

/** question_result → leaderboard. */
export async function showLeaderboard(roomId: string, hostTokenHash: string): Promise<void> {
  const payload = await callRpc("show_leaderboard", {
    p_room_id: roomId,
    p_host_token_hash: hostTokenHash,
  });

  requireOk(payload);
}

/** leaderboard → finished. */
export async function finishRoom(roomId: string, hostTokenHash: string): Promise<void> {
  const payload = await callRpc("finish_room", {
    p_room_id: roomId,
    p_host_token_hash: hostTokenHash,
  });

  requireOk(payload);
}

/**
 * leaderboard → question (seuraava kysymys) tai leaderboard → finished.
 * Päätös tehdään palvelimella kysymyslistan pituuden perusteella.
 */
export async function advanceFromLeaderboard(
  roomId: string,
  hostTokenHash: string,
): Promise<"question" | "finished"> {
  const snapshot = await loadRoomSnapshot(roomId);

  if (snapshot.room.status !== "leaderboard") {
    throw new ApiError(
      409,
      "invalid_state",
      "Seuraava kysymys voidaan käynnistää vain tulostaulun jälkeen.",
    );
  }

  const nextIndex = snapshot.room.currentQuestionIndex + 1;

  if (hasQuestionAt(nextIndex)) {
    await startQuestion(roomId, hostTokenHash, nextIndex);
    return "question";
  }

  await finishRoom(roomId, hostTokenHash);
  return "finished";
}

export type SubmitAnswerParams = {
  roomId: string;
  playerId: string;
  questionIndex: number;
  answerIndex: number;
  isCorrect: boolean;
  pointsAwarded: number;
  responseTimeMs: number;
};

/** Tallentaa vastauksen ja päivittää pisteet atomisesti. */
export async function submitPlayerAnswer(params: SubmitAnswerParams): Promise<void> {
  const payload = await callRpc("submit_answer", {
    p_room_id: params.roomId,
    p_player_id: params.playerId,
    p_question_index: params.questionIndex,
    p_answer_index: params.answerIndex,
    p_is_correct: params.isCorrect,
    p_points_awarded: params.pointsAwarded,
    p_response_time_ms: params.responseTimeMs,
    p_server_now: new Date().toISOString(),
  });

  requireOk(payload);
}
