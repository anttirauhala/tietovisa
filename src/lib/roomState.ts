import "server-only";

import { ApiError } from "@/lib/api/errors";
import { rankPlayers } from "@/lib/game/leaderboard";
import { isRoomStatus, revealsAnswer } from "@/lib/game/stateMachine";
import {
  ANSWER_SLOT_COUNT,
  type HostState,
  type PlayerState,
  type PublicPlayer,
  type PublicQuestion,
  type RevealedQuestion,
  type RoomStatus,
  type RoomSummary,
} from "@/lib/game/types";
import {
  getQuestionCount,
  hasQuestionAt,
  toPublicQuestion,
  toRevealedQuestion,
} from "@/lib/questions";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { mapDatabaseError } from "@/lib/supabase/errors";
import { hashToken, hashesEqual } from "@/lib/tokens";

/**
 * Palvelinpuolen pelitilan rakentaminen.
 *
 * Tietokannan `room_snapshot`-funktio palauttaa vain julkiset kentät.
 * Roolikohtainen näkymä rakennetaan täällä: pelaajalle ei koskaan lähetetä
 * oikeaa vastausta ennen tulosvaihetta eikä kenenkään tokenia.
 */

type SnapshotRoom = {
  id: string;
  pin: string;
  status: RoomStatus;
  currentQuestionIndex: number;
  questionStartedAt: string | null;
  questionEndsAt: string | null;
  playerCount: number;
};

type SnapshotAnswer = {
  playerId: string;
  questionIndex: number;
  answerIndex: number;
  isCorrect: boolean;
  pointsAwarded: number;
  responseTimeMs: number;
  submittedAt: string;
};

type Snapshot = {
  room: SnapshotRoom;
  players: PublicPlayer[];
  answers: SnapshotAnswer[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

/** Tietokantavirheet muunnetaan selkokielisiksi API-virheiksi (ks. lib/supabase/errors). */

export async function loadRoomSnapshot(roomId: string): Promise<Snapshot> {
  const { data, error } = await getSupabaseAdmin().rpc("room_snapshot", { p_room_id: roomId });

  if (error) {
    throw mapDatabaseError(error);
  }

  if (!isRecord(data) || !isRecord(data.room)) {
    throw new ApiError(404, "not_found", "Pelihuonetta ei löytynyt.");
  }

  const room = data.room;

  if (!isRoomStatus(room.status)) {
    throw new ApiError(500, "server_error");
  }

  const players: PublicPlayer[] = Array.isArray(data.players)
    ? data.players.filter(isRecord).map((player) => ({
        id: String(player.id),
        nickname: String(player.nickname),
        score: Number(player.score ?? 0),
        correctCount: Number(player.correctCount ?? 0),
        joinedAt: String(player.joinedAt ?? new Date(0).toISOString()),
      }))
    : [];

  const answers: SnapshotAnswer[] = Array.isArray(data.answers)
    ? data.answers.filter(isRecord).map((answer) => ({
        playerId: String(answer.playerId),
        questionIndex: Number(answer.questionIndex ?? 0),
        answerIndex: Number(answer.answerIndex ?? 0),
        isCorrect: Boolean(answer.isCorrect),
        pointsAwarded: Number(answer.pointsAwarded ?? 0),
        responseTimeMs: Number(answer.responseTimeMs ?? 0),
        submittedAt: String(answer.submittedAt ?? ""),
      }))
    : [];

  return {
    room: {
      id: String(room.id),
      pin: String(room.pin ?? ""),
      status: room.status,
      currentQuestionIndex: Number(room.currentQuestionIndex ?? 0),
      questionStartedAt: room.questionStartedAt ? String(room.questionStartedAt) : null,
      questionEndsAt: room.questionEndsAt ? String(room.questionEndsAt) : null,
      playerCount: Number(room.playerCount ?? players.length),
    },
    players,
    answers,
  };
}

function toRoomSummary(room: SnapshotRoom): RoomSummary {
  return {
    id: room.id,
    pin: room.pin,
    status: room.status,
    currentQuestionIndex: room.currentQuestionIndex,
    questionStartedAt: room.questionStartedAt,
    questionEndsAt: room.questionEndsAt,
    playerCount: room.playerCount,
    questionCount: getQuestionCount(),
  };
}

function buildDistribution(snapshot: Snapshot): number[] {
  const distribution = new Array<number>(ANSWER_SLOT_COUNT).fill(0);
  for (const answer of snapshot.answers) {
    if (
      answer.questionIndex === snapshot.room.currentQuestionIndex &&
      answer.answerIndex >= 0 &&
      answer.answerIndex < ANSWER_SLOT_COUNT
    ) {
      distribution[answer.answerIndex] += 1;
    }
  }
  return distribution;
}

function buildQuestion(snapshot: Snapshot): PublicQuestion | RevealedQuestion | null {
  const { status, currentQuestionIndex } = snapshot.room;

  if (status === "lobby" || status === "finished") {
    return null;
  }

  if (!hasQuestionAt(currentQuestionIndex)) {
    return null;
  }

  if (revealsAnswer(status)) {
    return toRevealedQuestion(currentQuestionIndex, buildDistribution(snapshot));
  }

  return toPublicQuestion(currentQuestionIndex);
}

/** Tarkistaa juontajan tokenin. Hash-vertailu tehdään vakioaikaisesti. */
export async function requireHostSession(
  roomId: string,
  hostToken: string | null,
): Promise<{ roomId: string }> {
  if (!hostToken) {
    throw new ApiError(401, "invalid_token", "Juontajan istunto puuttuu.");
  }

  const { data, error } = await getSupabaseAdmin()
    .from("rooms")
    .select("id, host_token_hash")
    .eq("id", roomId)
    .maybeSingle();

  if (error) {
    throw mapDatabaseError(error);
  }

  if (!data) {
    throw new ApiError(404, "not_found", "Pelihuonetta ei löytynyt.");
  }

  if (!hashesEqual(data.host_token_hash, hashToken(hostToken))) {
    throw new ApiError(401, "invalid_token", "Juontajan istunto ei ole kelvollinen.");
  }

  return { roomId: data.id };
}

/** Tarkistaa pelaajan tokenin ja huonejäsenyyden. */
export async function requirePlayerSession(
  roomId: string,
  playerToken: string | null,
): Promise<{ playerId: string; nickname: string }> {
  if (!playerToken) {
    throw new ApiError(401, "invalid_token", "Pelaajan istunto puuttuu.");
  }

  const { data, error } = await getSupabaseAdmin()
    .from("players")
    .select("id, nickname, token_hash")
    .eq("room_id", roomId)
    .eq("token_hash", hashToken(playerToken))
    .maybeSingle();

  if (error) {
    throw mapDatabaseError(error);
  }

  if (!data) {
    throw new ApiError(401, "invalid_token", "Pelaajan istunto ei ole kelvollinen.");
  }

  return { playerId: data.id, nickname: data.nickname };
}

export async function buildHostState(roomId: string, hostToken: string | null): Promise<HostState> {
  await requireHostSession(roomId, hostToken);
  const snapshot = await loadRoomSnapshot(roomId);

  return {
    role: "host",
    serverNow: new Date().toISOString(),
    room: toRoomSummary(snapshot.room),
    players: rankPlayers(snapshot.players),
    answerCount: snapshot.answers.filter(
      (answer) => answer.questionIndex === snapshot.room.currentQuestionIndex,
    ).length,
    question: buildQuestion(snapshot),
  };
}

export async function buildPlayerState(
  roomId: string,
  playerToken: string | null,
): Promise<PlayerState> {
  const session = await requirePlayerSession(roomId, playerToken);
  const snapshot = await loadRoomSnapshot(roomId);
  const ranked = rankPlayers(snapshot.players);
  const self = ranked.find((player) => player.id === session.playerId);

  if (!self) {
    throw new ApiError(401, "invalid_token", "Pelaajaa ei löytynyt tästä huoneesta.");
  }

  const ownAnswer =
    snapshot.answers.find(
      (answer) =>
        answer.playerId === session.playerId &&
        answer.questionIndex === snapshot.room.currentQuestionIndex,
    ) ?? null;

  const showOwnResult = revealsAnswer(snapshot.room.status);

  return {
    role: "player",
    serverNow: new Date().toISOString(),
    room: toRoomSummary(snapshot.room),
    players: ranked,
    me: {
      id: self.id,
      nickname: self.nickname,
      score: self.score,
      correctCount: self.correctCount,
      rank: self.rank,
      totalPlayers: ranked.length,
      hasAnsweredCurrent: ownAnswer !== null,
      myAnswerIndex: ownAnswer ? ownAnswer.answerIndex : null,
      currentPointsAwarded: showOwnResult && ownAnswer ? ownAnswer.pointsAwarded : null,
      currentIsCorrect: showOwnResult && ownAnswer ? ownAnswer.isCorrect : null,
    },
    question: buildQuestion(snapshot),
  };
}
