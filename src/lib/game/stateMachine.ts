import { ROOM_STATUSES, type RoomStatus } from "./types";

/**
 * Pelin eksplisiittinen tilakone.
 *
 * Sallitut siirtymät:
 *   lobby           → question
 *   question        → question_result
 *   question_result → leaderboard
 *   leaderboard     → question | finished
 *   finished        → (ei siirtymiä)
 *
 * Palvelin tarkistaa jokaisen siirtymän. Sama sääntö on toteutettu myös
 * tietokannan RPC-funktioissa, jotka hoitavat siirtymän atomisesti.
 */

export const ALLOWED_TRANSITIONS: Record<RoomStatus, readonly RoomStatus[]> = {
  lobby: ["question"],
  question: ["question_result"],
  question_result: ["leaderboard"],
  leaderboard: ["question", "finished"],
  finished: [],
};

export type HostAction = "start" | "reveal" | "leaderboard" | "next" | "finish";

export function isRoomStatus(value: unknown): value is RoomStatus {
  return typeof value === "string" && (ROOM_STATUSES as readonly string[]).includes(value);
}

export function canTransition(from: RoomStatus, to: RoomStatus): boolean {
  return ALLOWED_TRANSITIONS[from].includes(to);
}

export class InvalidTransitionError extends Error {
  constructor(
    readonly from: RoomStatus,
    readonly to: RoomStatus,
  ) {
    super(`Virheellinen tilasiirtymä: ${from} → ${to}`);
    this.name = "InvalidTransitionError";
  }
}

export function assertTransition(from: RoomStatus, to: RoomStatus): void {
  if (!canTransition(from, to)) {
    throw new InvalidTransitionError(from, to);
  }
}

/** Ottaako peli vastaan vastauksia tässä tilassa? */
export function acceptsAnswers(status: RoomStatus): boolean {
  return status === "question";
}

/** Näkyykö kysymys pelaajille tässä tilassa? */
export function isQuestionVisible(status: RoomStatus): boolean {
  return status !== "lobby";
}

/** Saako oikean vastauksen paljastaa tässä tilassa? */
export function revealsAnswer(status: RoomStatus): boolean {
  return status === "question_result" || status === "leaderboard" || status === "finished";
}

/**
 * Mitä tilaa juontajan komento tavoittelee nykyisestä tilasta.
 * Heittää InvalidTransitionError, jos komento ei ole sallittu.
 */
export function transitionForAction(from: RoomStatus, action: HostAction): RoomStatus {
  switch (action) {
    case "start":
      if (from !== "lobby") {
        throw new InvalidTransitionError(from, "question");
      }
      return "question";
    case "reveal":
      if (from !== "question") {
        throw new InvalidTransitionError(from, "question_result");
      }
      return "question_result";
    case "leaderboard":
      if (from !== "question_result") {
        throw new InvalidTransitionError(from, "leaderboard");
      }
      return "leaderboard";
    case "next":
      if (from !== "leaderboard") {
        throw new InvalidTransitionError(from, "question");
      }
      return "question";
    case "finish":
      if (from !== "leaderboard") {
        throw new InvalidTransitionError(from, "finished");
      }
      return "finished";
    default: {
      const exhaustive: never = action;
      throw new Error(`Tuntematon komento: ${String(exhaustive)}`);
    }
  }
}

export function describeStatus(status: RoomStatus): string {
  switch (status) {
    case "lobby":
      return "Odotushuone";
    case "question":
      return "Kysymys";
    case "question_result":
      return "Oikea vastaus";
    case "leaderboard":
      return "Tulostaulu";
    case "finished":
      return "Peli päättynyt";
    default:
      return "Tuntematon tila";
  }
}
