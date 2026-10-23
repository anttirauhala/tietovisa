import type { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { getQuestionAt, getQuestionCount, scoreAnswer } from "@/lib/questions";

import {
  callRpc,
  callRpcStatus,
  closeTestDatabase,
  createTestDatabase,
  submitAnswer,
} from "./database";

/**
 * Pelin keskeyttäminen: kysymyksen lopettaminen kesken määräajan ja pelin
 * päättäminen ennen viimeistä kysymystä.
 *
 * Molemmat ovat tilanteita, joita pikkujouluissa oikeasti tulee vastaan
 * (puheenvuoro, aikataulu, porukka on valmis aiemmin).
 */

const HOST = "9".repeat(64);
const WRONG_HOST = "8".repeat(64);
const TOKEN_P1 = "7".repeat(64);
const LIMIT_MS = 20_000;

let db: PGlite;

async function newRoom(pin: string) {
  const roomId = await callRpc<string>(db, "create_room", [pin, HOST]);
  const player = await callRpcStatus(db, "join_room", [pin, "Aino", TOKEN_P1]);
  return { roomId, playerId: String(player.playerId) };
}

async function startQuestion(roomId: string, index: number, startedAtMs: number) {
  return callRpcStatus(db, "start_question", [
    roomId,
    HOST,
    index,
    new Date(startedAtMs).toISOString(),
    new Date(startedAtMs + LIMIT_MS).toISOString(),
  ]);
}

beforeAll(async () => {
  db = await createTestDatabase();
});

afterAll(async () => {
  await closeTestDatabase(db);
});

describe("kysymyksen keskeyttäminen kesken määräajan", () => {
  it("siirtää määräajan nykyhetkeen ja mahdollistaa tulosvaiheen heti", async () => {
    const { roomId } = await newRoom("400001");
    const startedAtMs = Date.now();
    await startQuestion(roomId, 0, startedAtMs);

    // Kesken kysymystä tulosvaihe on vielä estetty.
    const tooEarly = await callRpcStatus(db, "reveal_question", [
      roomId,
      HOST,
      new Date(startedAtMs + 1_000).toISOString(),
    ]);
    expect(tooEarly.status).toBe("too_early");

    // Juontaja keskeyttää kysymyksen.
    const ended = await callRpcStatus(db, "end_question_now", [
      roomId,
      HOST,
      new Date(startedAtMs + 2_000).toISOString(),
    ]);
    expect(ended.status).toBe("ok");

    // Tulosvaihe onnistuu nyt, vaikka alkuperäinen määräaika ei ole kulunut.
    const revealed = await callRpcStatus(db, "reveal_question", [
      roomId,
      HOST,
      new Date(startedAtMs + 2_100).toISOString(),
    ]);
    expect(revealed.status).toBe("ok");

    const room = await db.query<{ status: string }>(
      `select status from public.rooms where id = $1`,
      [roomId],
    );
    expect(room.rows[0].status).toBe("question_result");
  });

  it("hylkää keskeytyksen jälkeen saapuvat vastaukset myöhäisinä", async () => {
    const { roomId, playerId } = await newRoom("400002");
    const startedAtMs = Date.now();
    const question = getQuestionAt(0);

    await startQuestion(roomId, 0, startedAtMs);

    const endAtMs = startedAtMs + 3_000;
    await callRpcStatus(db, "end_question_now", [roomId, HOST, new Date(endAtMs).toISOString()]);

    const late = await submitAnswer(db, {
      roomId,
      playerId,
      questionIndex: 0,
      answerIndex: question.correctAnswerIndex,
      isCorrect: true,
      points: scoreAnswer(0, question.correctAnswerIndex, 3_100),
      responseTimeMs: 3_100,
      serverNow: new Date(endAtMs + 100).toISOString(),
    });

    expect(late.status).toBe("late");

    // Ennen keskeytystä ehtinyt vastaus on edelleen kelvollinen.
    const inTime = await submitAnswer(db, {
      roomId,
      playerId,
      questionIndex: 0,
      answerIndex: question.correctAnswerIndex,
      isCorrect: true,
      points: scoreAnswer(0, question.correctAnswerIndex, 1_000),
      responseTimeMs: 1_000,
      serverNow: new Date(startedAtMs + 1_000).toISOString(),
    });

    expect(inTime.status).toBe("ok");
  });

  it("vaatii juontajan tokenin eikä toimi väärässä tilassa", async () => {
    const { roomId } = await newRoom("400003");
    const startedAtMs = Date.now();

    // Ennen kysymyksen alkua huone on lobby-tilassa.
    const wrongState = await callRpcStatus(db, "end_question_now", [
      roomId,
      HOST,
      new Date(startedAtMs).toISOString(),
    ]);
    expect(wrongState.status).toBe("invalid_state");

    await startQuestion(roomId, 0, startedAtMs);

    const forbidden = await callRpcStatus(db, "end_question_now", [
      roomId,
      WRONG_HOST,
      new Date(startedAtMs + 100).toISOString(),
    ]);
    expect(forbidden.status).toBe("forbidden");

    const missingRoom = await callRpcStatus(db, "end_question_now", [
      "00000000-0000-0000-0000-000000000000",
      HOST,
      new Date(startedAtMs).toISOString(),
    ]);
    expect(missingRoom.status).toBe("room_not_found");
  });

  it("on idempotentti: toinen keskeytys ei muuta määräaikaa", async () => {
    const { roomId } = await newRoom("400004");
    const startedAtMs = Date.now();
    await startQuestion(roomId, 0, startedAtMs);

    const first = await callRpcStatus(db, "end_question_now", [
      roomId,
      HOST,
      new Date(startedAtMs + 1_000).toISOString(),
    ]);
    const second = await callRpcStatus(db, "end_question_now", [
      roomId,
      HOST,
      new Date(startedAtMs + 2_000).toISOString(),
    ]);

    expect(first.status).toBe("ok");
    expect(second.status).toBe("ok");

    const room = await db.query<{ question_ends_at: string }>(
      `select question_ends_at from public.rooms where id = $1`,
      [roomId],
    );
    expect(new Date(room.rows[0].question_ends_at).toISOString()).toBe(
      new Date(startedAtMs + 1_000).toISOString(),
    );
  });
});

describe("pelin päättäminen kesken kysymyssarjan", () => {
  it("päättää pelin tulostaululta, vaikka kysymyksiä olisi jäljellä", async () => {
    const { roomId } = await newRoom("400005");
    const totalQuestions = getQuestionCount();
    const startedAtMs = Date.now();

    await startQuestion(roomId, 0, startedAtMs);
    await callRpcStatus(db, "reveal_question", [
      roomId,
      HOST,
      new Date(startedAtMs + LIMIT_MS + 10).toISOString(),
    ]);
    await callRpcStatus(db, "show_leaderboard", [roomId, HOST]);

    // Kysymyksiä on jäljellä, mutta juontaja päättää pelin.
    const finished = await callRpcStatus(db, "finish_room", [roomId, HOST]);
    expect(finished.status).toBe("ok");

    const room = await db.query<{ status: string; current_question_index: number }>(
      `select status, current_question_index from public.rooms where id = $1`,
      [roomId],
    );
    expect(room.rows[0].status).toBe("finished");
    expect(room.rows[0].current_question_index).toBeLessThan(totalQuestions - 1);

    // Päätetyssä pelissä ei voi enää jatkaa.
    const restart = await callRpcStatus(db, "start_question", [
      roomId,
      HOST,
      1,
      new Date().toISOString(),
      new Date(Date.now() + LIMIT_MS).toISOString(),
    ]);
    expect(restart.status).toBe("invalid_state");
  });

  it("ei salli pelin päättämistä kesken kysymystä", async () => {
    const { roomId } = await newRoom("400006");
    await startQuestion(roomId, 0, Date.now());

    const result = await callRpcStatus(db, "finish_room", [roomId, HOST]);
    expect(result.status).toBe("invalid_state");
  });
});
