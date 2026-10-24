import type { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { getQuestionAt, getQuestionCount, scoreAnswer } from "@/lib/questions";

import { callRpc, callRpcStatus, closeTestDatabase, createTestDatabase } from "./database";

/**
 * Koko pelin kulku tietokantatasolla: huoneen luonti, pelaajien liittyminen,
 * vastausten vastaanotto, palvelinpuolen pisteytys, tulosvaihe, tulostaulu ja
 * pelin päättäminen.
 *
 * Testit ajetaan oikealla PostgreSQL-moottorilla (PGlite), samoilla
 * migraatioilla kuin tuotannossa.
 */

const HOST = "1".repeat(64);
const TOKEN_P1 = "2".repeat(64);
const TOKEN_P2 = "3".repeat(64);
const LIMIT_MS = 20_000;

let db: PGlite;

async function createRoomWithPlayers(pin: string) {
  const roomId = await callRpc<string>(db, "create_room", [pin, HOST]);
  const first = await callRpcStatus(db, "join_room", [pin, "Aino", TOKEN_P1]);
  const second = await callRpcStatus(db, "join_room", [pin, "Eino", TOKEN_P2]);

  return {
    roomId,
    playerOne: String(first.playerId),
    playerTwo: String(second.playerId),
  };
}

async function startQuestion(
  roomId: string,
  index: number,
  startedAtMs: number,
  limitMs = LIMIT_MS,
) {
  return callRpcStatus(db, "start_question", [
    roomId,
    HOST,
    index,
    new Date(startedAtMs).toISOString(),
    new Date(startedAtMs + limitMs).toISOString(),
  ]);
}

async function answer(
  roomId: string,
  playerId: string,
  questionIndex: number,
  answerIndex: number,
  points: number,
  isCorrect: boolean,
  receivedAtMs: number,
  responseTimeMs = 500,
) {
  return callRpcStatus(db, "submit_answer", [
    roomId,
    playerId,
    questionIndex,
    answerIndex,
    isCorrect,
    points,
    responseTimeMs,
    new Date(receivedAtMs).toISOString(),
  ]);
}

async function readPlayer(roomId: string, playerId: string) {
  const result = await db.query<{ score: number; correct_count: number }>(
    `select score, correct_count from public.players where id = $1 and room_id = $2`,
    [playerId, roomId],
  );
  return result.rows[0];
}

beforeAll(async () => {
  db = await createTestDatabase();
});

afterAll(async () => {
  await closeTestDatabase(db);
});

describe("vastauksen vastaanotto ja pisteytys", () => {
  it("palkitsee oikean vastauksen palvelinpuolen pisteytyksellä", async () => {
    const { roomId, playerOne, playerTwo } = await createRoomWithPlayers("200001");
    const startedAtMs = Date.now();
    const receivedAtMs = startedAtMs + 1000;

    await startQuestion(roomId, 0, startedAtMs);

    const question = getQuestionAt(0);
    const expectedPoints = scoreAnswer(0, question.correctAnswerIndex, 1000);
    expect(expectedPoints).toBeGreaterThan(0);

    const correct = await answer(
      roomId,
      playerOne,
      0,
      question.correctAnswerIndex,
      expectedPoints,
      true,
      receivedAtMs,
    );

    expect(correct.status).toBe("ok");
    expect(correct.pointsAwarded).toBe(expectedPoints);

    const wrongIndex = (question.correctAnswerIndex + 1) % 4;
    const wrong = await answer(roomId, playerTwo, 0, wrongIndex, 0, false, receivedAtMs);

    expect(wrong.status).toBe("ok");
    expect(wrong.pointsAwarded).toBe(0);

    expect(await readPlayer(roomId, playerOne)).toEqual({
      score: expectedPoints,
      correct_count: 1,
    });
    expect(await readPlayer(roomId, playerTwo)).toEqual({ score: 0, correct_count: 0 });
  });

  it("antaa nopeammasta vastauksesta enemmän pisteitä kuin hitaasta", async () => {
    const { roomId, playerOne, playerTwo } = await createRoomWithPlayers("200002");
    const startedAtMs = Date.now();
    const question = getQuestionAt(1);

    await startQuestion(roomId, 0, startedAtMs);

    const fastPoints = scoreAnswer(0, question.correctAnswerIndex, 500);
    const slowPoints = scoreAnswer(0, question.correctAnswerIndex, LIMIT_MS - 500);

    await answer(
      roomId,
      playerOne,
      0,
      question.correctAnswerIndex,
      fastPoints,
      true,
      startedAtMs + 500,
    );
    await answer(
      roomId,
      playerTwo,
      0,
      question.correctAnswerIndex,
      slowPoints,
      true,
      startedAtMs + LIMIT_MS - 500,
    );

    const fast = await readPlayer(roomId, playerOne);
    const slow = await readPlayer(roomId, playerTwo);

    expect(fast.score).toBeGreaterThan(slow.score);
  });

  it("hylkää toisen vastauksen samalta pelaajalta eikä pisteytä kahdesti", async () => {
    const { roomId, playerOne } = await createRoomWithPlayers("200003");
    const startedAtMs = Date.now();
    const question = getQuestionAt(2);
    const points = scoreAnswer(0, question.correctAnswerIndex, 1000);

    await startQuestion(roomId, 0, startedAtMs);

    const [first, second] = await Promise.all([
      answer(roomId, playerOne, 0, question.correctAnswerIndex, points, true, startedAtMs + 1000),
      answer(roomId, playerOne, 0, question.correctAnswerIndex, points, true, startedAtMs + 1000),
    ]);

    expect([first.status, second.status].sort()).toEqual(["already_answered", "ok"]);

    // Pisteet kasvavat vain kerran.
    expect((await readPlayer(roomId, playerOne)).score).toBe(points);
  });

  it("hylkää myöhästyneen vastauksen", async () => {
    const { roomId, playerOne } = await createRoomWithPlayers("200004");
    const startedAtMs = Date.now();
    const question = getQuestionAt(3);

    await startQuestion(roomId, 0, startedAtMs);

    const late = await answer(
      roomId,
      playerOne,
      0,
      question.correctAnswerIndex,
      scoreAnswer(0, question.correctAnswerIndex, 1000),
      true,
      startedAtMs + LIMIT_MS + 1,
    );

    expect(late.status).toBe("late");
    expect((await readPlayer(roomId, playerOne)).score).toBe(0);
  });

  it("hylkää vastauksen, kun kysymys ei ole auki", async () => {
    const { roomId, playerOne } = await createRoomWithPlayers("200005");
    const startedAtMs = Date.now();
    const question = getQuestionAt(4);

    // Ennen kysymyksen alkua huone on yhä lobby-tilassa.
    const beforeStart = await answer(
      roomId,
      playerOne,
      0,
      question.correctAnswerIndex,
      1000,
      true,
      startedAtMs,
    );

    expect(beforeStart.status).toBe("closed");

    await startQuestion(roomId, 0, startedAtMs);
    await callRpcStatus(db, "reveal_question", [
      roomId,
      HOST,
      new Date(startedAtMs + LIMIT_MS + 10).toISOString(),
    ]);

    const afterReveal = await answer(
      roomId,
      playerOne,
      0,
      question.correctAnswerIndex,
      1000,
      true,
      startedAtMs + LIMIT_MS + 20,
    );

    expect(afterReveal.status).toBe("closed");
  });

  it("hylkää väärän kysymysindeksin ja virheellisen vastausvaihtoehdon", async () => {
    const { roomId, playerOne } = await createRoomWithPlayers("200006");
    const startedAtMs = Date.now();

    await startQuestion(roomId, 0, startedAtMs);

    const wrongQuestion = await answer(roomId, playerOne, 7, 0, 1000, true, startedAtMs + 100);
    expect(wrongQuestion.status).toBe("wrong_question");
    expect(wrongQuestion.activeQuestionIndex).toBe(0);

    const badIndex = await answer(roomId, playerOne, 0, 4, 1000, true, startedAtMs + 100);
    expect(badIndex.status).toBe("invalid_answer_index");
  });

  it("hylkää pelaajan, joka ei kuulu huoneeseen", async () => {
    const { roomId } = await createRoomWithPlayers("200007");
    const other = await createRoomWithPlayers("200008");
    const startedAtMs = Date.now();

    await startQuestion(roomId, 0, startedAtMs);

    const result = await answer(roomId, other.playerOne, 0, 0, 1000, true, startedAtMs + 100);

    expect(result.status).toBe("player_not_found");
  });
});

describe("koko peli alusta loppuun", () => {
  it("pelaa kaikki kysymykset läpi ja päättyy viimeisen tulostaulun kautta", async () => {
    const { roomId, playerOne, playerTwo } = await createRoomWithPlayers("300001");
    const totalQuestions = getQuestionCount();
    // Kysymysten määrä on sisältöratkaisu, joten testi ei lukitse tiettyä lukua.
    expect(totalQuestions).toBeGreaterThanOrEqual(5);

    const clock = Date.now();

    for (let index = 0; index < totalQuestions; index += 1) {
      const startedAtMs = clock + index * 1000;
      const started = await startQuestion(roomId, index, startedAtMs);
      expect(started.status).toBe("ok");

      const question = getQuestionAt(index);
      const correctIndex = question.correctAnswerIndex;

      const first = await answer(
        roomId,
        playerOne,
        index,
        correctIndex,
        scoreAnswer(index, correctIndex, 500),
        true,
        startedAtMs + 500,
      );
      expect(first.status).toBe("ok");

      // Toinen pelaaja vastaa väärin joka toisessa kysymyksessä.
      const secondCorrect = index % 2 === 0;
      const second = await answer(
        roomId,
        playerTwo,
        index,
        secondCorrect ? correctIndex : (correctIndex + 1) % 4,
        secondCorrect ? scoreAnswer(index, correctIndex, 500) : 0,
        secondCorrect,
        startedAtMs + 500,
      );
      expect(second.status).toBe("ok");

      const revealed = await callRpcStatus(db, "reveal_question", [
        roomId,
        HOST,
        new Date(startedAtMs + LIMIT_MS + 10).toISOString(),
      ]);
      expect(revealed.status).toBe("ok");

      const leaderboard = await callRpcStatus(db, "show_leaderboard", [roomId, HOST]);
      expect(leaderboard.status).toBe("ok");
    }

    const roomAfterLastQuestion = await db.query<{ status: string; current_question_index: number }>(
      `select status, current_question_index from public.rooms where id = $1`,
      [roomId],
    );

    expect(roomAfterLastQuestion.rows[0].status).toBe("leaderboard");
    expect(roomAfterLastQuestion.rows[0].current_question_index).toBe(totalQuestions - 1);

    const finished = await callRpcStatus(db, "finish_room", [roomId, HOST]);
    expect(finished.status).toBe("ok");

    const room = await db.query<{ status: string; question_ends_at: string | null }>(
      `select status, question_ends_at from public.rooms where id = $1`,
      [roomId],
    );
    expect(room.rows[0].status).toBe("finished");
    expect(room.rows[0].question_ends_at).toBeNull();

    // Päättyneessä pelissä ei voi enää edetä eikä vastata.
    const restart = await callRpcStatus(db, "start_question", [
      roomId,
      HOST,
      totalQuestions,
      new Date().toISOString(),
      new Date(Date.now() + LIMIT_MS).toISOString(),
    ]);
    expect(restart.status).toBe("invalid_state");

    const lateAnswer = await answer(
      roomId,
      playerOne,
      totalQuestions - 1,
      0,
      1000,
      true,
      Date.now(),
    );
    expect(lateAnswer.status).toBe("closed");

    const snapshot = await callRpc<{
      players: { nickname: string; score: number }[];
      room: { status: string };
    }>(db, "room_snapshot", [roomId]);

    expect(snapshot.room.status).toBe("finished");
    expect(snapshot.players[0].nickname).toBe("Aino");
    expect(snapshot.players[0].score).toBeGreaterThan(snapshot.players[1].score);
  });

  it("järjestää tulostaulun deterministisesti ja näyttää jaetun sijoituksen", async () => {
    const pin = "300002";
    const roomId = await callRpc<string>(db, "create_room", [pin, HOST]);
    const first = await callRpcStatus(db, "join_room", [pin, "Aino", TOKEN_P1]);
    const second = await callRpcStatus(db, "join_room", [pin, "Eino", TOKEN_P2]);
    const third = await callRpcStatus(db, "join_room", [pin, "Pekka", "5".repeat(64)]);

    const startedAtMs = Date.now();
    await startQuestion(roomId, 0, startedAtMs);

    const question = getQuestionAt(0);
    const points = scoreAnswer(0, question.correctAnswerIndex, 1000);

    await answer(
      roomId,
      String(first.playerId),
      0,
      question.correctAnswerIndex,
      points,
      true,
      startedAtMs + 1000,
    );
    await answer(
      roomId,
      String(second.playerId),
      0,
      question.correctAnswerIndex,
      points,
      true,
      startedAtMs + 1000,
    );
    await answer(
      roomId,
      String(third.playerId),
      0,
      (question.correctAnswerIndex + 1) % 4,
      0,
      false,
      startedAtMs + 1000,
    );

    const snapshot = await callRpc<{
      players: { nickname: string; score: number; correctCount: number }[];
    }>(db, "room_snapshot", [roomId]);

    expect(snapshot.players.map((player) => player.nickname)).toEqual([
      "Aino",
      "Eino",
      "Pekka",
    ]);
    expect(snapshot.players[0].score).toBe(points);
    expect(snapshot.players[1].score).toBe(points);
    expect(snapshot.players[2].score).toBe(0);
  });
});
