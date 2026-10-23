import { describe, expect, it } from "vitest";

import { validateAnswerSubmission, type AnswerValidationInput } from "./answerValidation";

const STARTED_AT = "2026-01-01T12:00:00.000Z";
const ENDS_AT = "2026-01-01T12:00:20.000Z";

function baseInput(overrides: Partial<AnswerValidationInput> = {}): AnswerValidationInput {
  return {
    roomStatus: "question",
    activeQuestionIndex: 3,
    submittedQuestionIndex: 3,
    answerIndex: 1,
    questionStartedAt: STARTED_AT,
    questionEndsAt: ENDS_AT,
    serverNowMs: Date.parse("2026-01-01T12:00:05.000Z"),
    alreadyAnswered: false,
    playerBelongsToRoom: true,
    ...overrides,
  };
}

describe("validateAnswerSubmission", () => {
  it("hyväksyy vastauksen kesken kysymyksen ja laskee vastausajan palvelimen kellosta", () => {
    const result = validateAnswerSubmission(baseInput());

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.elapsedMs).toBe(5000);
      expect(result.responseTimeMs).toBe(5000);
    }
  });

  it("hylkää vastauksen aikarajan jälkeen", () => {
    const result = validateAnswerSubmission(
      baseInput({ serverNowMs: Date.parse("2026-01-01T12:00:20.001Z") }),
    );

    expect(result).toEqual({ ok: false, reason: "late" });
  });

  it("hyväksyy vastauksen juuri ennen määräaikaa", () => {
    const result = validateAnswerSubmission(
      baseInput({ serverNowMs: Date.parse("2026-01-01T12:00:19.999Z") }),
    );

    expect(result.ok).toBe(true);
  });

  it("hylkää toisen vastauksen samalta pelaajalta", () => {
    const result = validateAnswerSubmission(baseInput({ alreadyAnswered: true }));

    expect(result).toEqual({ ok: false, reason: "already_answered" });
  });

  it("hylkää vastauksen väärään kysymysindeksiin", () => {
    const result = validateAnswerSubmission(baseInput({ submittedQuestionIndex: 4 }));

    expect(result).toEqual({ ok: false, reason: "wrong_question" });
  });

  it("hylkää vastauksen, kun kysymys ei ole auki", () => {
    expect(validateAnswerSubmission(baseInput({ roomStatus: "lobby" }))).toEqual({
      ok: false,
      reason: "room_not_active",
    });
    expect(validateAnswerSubmission(baseInput({ roomStatus: "question_result" }))).toEqual({
      ok: false,
      reason: "room_not_active",
    });
    expect(validateAnswerSubmission(baseInput({ roomStatus: "finished" }))).toEqual({
      ok: false,
      reason: "room_not_active",
    });
  });

  it("hylkää virheellisen vastausvaihtoehdon", () => {
    for (const answerIndex of [-1, 4, 1.5, Number.NaN]) {
      expect(validateAnswerSubmission(baseInput({ answerIndex }))).toEqual({
        ok: false,
        reason: "invalid_answer_index",
      });
    }
  });

  it("hylkää vastauksen, jos kysymys ei ole vielä alkanut", () => {
    const result = validateAnswerSubmission(
      baseInput({ serverNowMs: Date.parse("2026-01-01T11:59:59.000Z") }),
    );

    expect(result).toEqual({ ok: false, reason: "not_started" });
  });

  it("hylkää vastauksen, jos kysymyksen aikaleimoja ei ole", () => {
    expect(validateAnswerSubmission(baseInput({ questionStartedAt: null }))).toEqual({
      ok: false,
      reason: "not_started",
    });
    expect(validateAnswerSubmission(baseInput({ questionEndsAt: null }))).toEqual({
      ok: false,
      reason: "not_started",
    });
  });

  it("hylkää vastauksen, jos huonetta ei ole", () => {
    expect(validateAnswerSubmission(baseInput({ roomStatus: null }))).toEqual({
      ok: false,
      reason: "room_not_found",
    });
  });

  it("hylkää vastauksen, jos pelaaja ei kuulu huoneeseen", () => {
    expect(validateAnswerSubmission(baseInput({ playerBelongsToRoom: false }))).toEqual({
      ok: false,
      reason: "player_not_in_room",
    });
  });

  it("tarkistaa tilan ennen toista vastausta ja myöhästymistä", () => {
    // Väärä kysymys ohittaa muut tarkistukset vasta tilan jälkeen.
    const result = validateAnswerSubmission(
      baseInput({ submittedQuestionIndex: 9, alreadyAnswered: true, roomStatus: "lobby" }),
    );

    expect(result).toEqual({ ok: false, reason: "room_not_active" });
  });
});
