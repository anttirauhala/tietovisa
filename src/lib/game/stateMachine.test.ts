import { describe, expect, it } from "vitest";

import {
  acceptsAnswers,
  ALLOWED_TRANSITIONS,
  assertTransition,
  canTransition,
  InvalidTransitionError,
  isRoomStatus,
  isQuestionVisible,
  revealsAnswer,
  transitionForAction,
} from "./stateMachine";
import { ROOM_STATUSES, type RoomStatus } from "./types";

describe("pelin tilakone", () => {
  it("tuntee kaikki tilat", () => {
    expect(ROOM_STATUSES).toEqual([
      "lobby",
      "question",
      "question_result",
      "leaderboard",
      "finished",
    ]);
    for (const status of ROOM_STATUSES) {
      expect(isRoomStatus(status)).toBe(true);
    }
    expect(isRoomStatus("kesken")).toBe(false);
    expect(isRoomStatus(null)).toBe(false);
  });

  it("sallii vain määritellyt siirtymät", () => {
    expect(canTransition("lobby", "question")).toBe(true);
    expect(canTransition("question", "question_result")).toBe(true);
    expect(canTransition("question_result", "leaderboard")).toBe(true);
    expect(canTransition("leaderboard", "question")).toBe(true);
    expect(canTransition("leaderboard", "finished")).toBe(true);
  });

  it("estää virheelliset siirtymät", () => {
    const forbidden: Array<[RoomStatus, RoomStatus]> = [
      ["lobby", "question_result"],
      ["lobby", "leaderboard"],
      ["lobby", "finished"],
      ["question", "question"],
      ["question", "leaderboard"],
      ["question", "finished"],
      ["question_result", "question"],
      ["question_result", "finished"],
      ["leaderboard", "question_result"],
      ["finished", "question"],
      ["finished", "leaderboard"],
      ["finished", "finished"],
    ];

    for (const [from, to] of forbidden) {
      expect(canTransition(from, to)).toBe(false);
      expect(() => assertTransition(from, to)).toThrow(InvalidTransitionError);
    }
  });

  it("kieltää kaikki siirtymät päättyneestä pelistä", () => {
    expect(ALLOWED_TRANSITIONS.finished).toEqual([]);
  });

  it("muuntaa juontajan komennot tilasiirtymiksi", () => {
    expect(transitionForAction("lobby", "start")).toBe("question");
    expect(transitionForAction("question", "reveal")).toBe("question_result");
    expect(transitionForAction("question_result", "leaderboard")).toBe("leaderboard");
    expect(transitionForAction("leaderboard", "next")).toBe("question");
    expect(transitionForAction("leaderboard", "finish")).toBe("finished");
  });

  it("estää komennot väärässä tilassa", () => {
    expect(() => transitionForAction("lobby", "reveal")).toThrow(InvalidTransitionError);
    expect(() => transitionForAction("lobby", "next")).toThrow(InvalidTransitionError);
    expect(() => transitionForAction("question", "start")).toThrow(InvalidTransitionError);
    expect(() => transitionForAction("question_result", "finish")).toThrow(InvalidTransitionError);
    expect(() => transitionForAction("finished", "next")).toThrow(InvalidTransitionError);
  });

  it("hyväksyy vastauksia vain kysymysvaiheessa", () => {
    expect(acceptsAnswers("question")).toBe(true);
    expect(acceptsAnswers("lobby")).toBe(false);
    expect(acceptsAnswers("question_result")).toBe(false);
    expect(acceptsAnswers("leaderboard")).toBe(false);
    expect(acceptsAnswers("finished")).toBe(false);
  });

  it("näyttää kysymyksen vasta pelin alettua", () => {
    expect(isQuestionVisible("lobby")).toBe(false);
    expect(isQuestionVisible("question")).toBe(true);
    expect(isQuestionVisible("finished")).toBe(true);
  });

  it("paljastaa oikean vastauksen vain tulosvaiheessa", () => {
    expect(revealsAnswer("lobby")).toBe(false);
    expect(revealsAnswer("question")).toBe(false);
    expect(revealsAnswer("question_result")).toBe(true);
    expect(revealsAnswer("leaderboard")).toBe(true);
    expect(revealsAnswer("finished")).toBe(true);
  });
});
