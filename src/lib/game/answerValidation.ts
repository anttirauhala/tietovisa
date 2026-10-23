import type { RoomStatus } from "./types";

/**
 * Vastauksen hyväksymisen tarkistus. Puhdas funktio, jotta sama logiikka on
 * testattavissa ilman selainta ja tietokantaa.
 *
 * Palvelin tarkistaa tämän lisäksi atomisesti RPC-funktiossa, ettei kahta
 * vastausta päädy samaan kysymykseen kilpailevissa pyynnöissä.
 */

export type AnswerRejectionReason =
  | "room_not_found"
  | "room_not_active"
  | "wrong_question"
  | "invalid_answer_index"
  | "not_started"
  | "late"
  | "already_answered"
  | "player_not_in_room";

export type AnswerValidationInput = {
  roomStatus: RoomStatus | null;
  /** Huoneen aktiivinen kysymysindeksi. */
  activeQuestionIndex: number;
  /** Selaimen ilmoittama kysymysindeksi. */
  submittedQuestionIndex: number;
  /** Valittu vastausvaihtoehto 0–3. */
  answerIndex: number;
  questionStartedAt: string | null;
  questionEndsAt: string | null;
  /** Palvelimen kellonaika millisekunteina. */
  serverNowMs: number;
  alreadyAnswered: boolean;
  playerBelongsToRoom: boolean;
};

export type AnswerValidationResult =
  | { ok: true; elapsedMs: number; responseTimeMs: number }
  | { ok: false; reason: AnswerRejectionReason };

export function validateAnswerSubmission(input: AnswerValidationInput): AnswerValidationResult {
  if (input.roomStatus === null) {
    return { ok: false, reason: "room_not_found" };
  }

  if (!input.playerBelongsToRoom) {
    return { ok: false, reason: "player_not_in_room" };
  }

  if (input.roomStatus !== "question") {
    return { ok: false, reason: "room_not_active" };
  }

  if (input.submittedQuestionIndex !== input.activeQuestionIndex) {
    return { ok: false, reason: "wrong_question" };
  }

  if (
    !Number.isInteger(input.answerIndex) ||
    input.answerIndex < 0 ||
    input.answerIndex > 3
  ) {
    return { ok: false, reason: "invalid_answer_index" };
  }

  if (input.alreadyAnswered) {
    return { ok: false, reason: "already_answered" };
  }

  const startedAtMs = parseTimestamp(input.questionStartedAt);
  const endsAtMs = parseTimestamp(input.questionEndsAt);

  if (startedAtMs === null || endsAtMs === null) {
    return { ok: false, reason: "not_started" };
  }

  if (input.serverNowMs < startedAtMs) {
    return { ok: false, reason: "not_started" };
  }

  if (input.serverNowMs > endsAtMs) {
    return { ok: false, reason: "late" };
  }

  const elapsedMs = input.serverNowMs - startedAtMs;

  return { ok: true, elapsedMs, responseTimeMs: elapsedMs };
}

function parseTimestamp(value: string | null): number | null {
  if (!value) {
    return null;
  }
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? null : parsed;
}

/** Suomenkieliset virheilmoitukset käyttöliittymälle. */
export function answerRejectionMessage(reason: AnswerRejectionReason): string {
  switch (reason) {
    case "room_not_found":
      return "Pelihuonetta ei löytynyt.";
    case "room_not_active":
      return "Kysymys ei ole juuri nyt auki.";
    case "wrong_question":
      return "Vastasit väärään kysymykseen. Odota seuraavaa kysymystä.";
    case "invalid_answer_index":
      return "Virheellinen vastausvaihtoehto.";
    case "not_started":
      return "Kysymys ei ole vielä alkanut.";
    case "late":
      return "Aika ehti loppua ennen kuin vastauksesi saapui palvelimelle.";
    case "already_answered":
      return "Olet jo vastannut tähän kysymykseen.";
    case "player_not_in_room":
      return "Pelaajaa ei löytynyt tästä huoneesta.";
    default:
      return "Vastausta ei voitu tallentaa.";
  }
}
