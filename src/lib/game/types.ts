/**
 * Pelin yhteiset tyypit. Tämä moduuli on puhdas: sitä voi käyttää sekä
 * palvelimella että selaimessa, eikä se sisällä vastausavainta.
 */

export const ROOM_STATUSES = [
  "lobby",
  "question",
  "question_result",
  "leaderboard",
  "finished",
] as const;

export type RoomStatus = (typeof ROOM_STATUSES)[number];

/** Julkinen pelaajatieto, joka voidaan näyttää kaikille. */
export type PublicPlayer = {
  id: string;
  nickname: string;
  score: number;
  correctCount: number;
  joinedAt: string;
};

export type RankedPlayer = PublicPlayer & {
  rank: number;
  isTied: boolean;
};

/** Kysymys ilman vastausavainta: turvallinen lähettää selaimelle. */
export type PublicQuestion = {
  index: number;
  total: number;
  category: string;
  question: string;
  answers: string[];
  timeLimitSeconds: number;
  points: number;
};

/** Kysymys tulosvaiheessa: oikea vastaus ja jakauma saa paljastaa. */
export type RevealedQuestion = PublicQuestion & {
  correctAnswerIndex: number;
  distribution: number[];
};

export type RoomSummary = {
  id: string;
  pin: string;
  status: RoomStatus;
  currentQuestionIndex: number;
  questionStartedAt: string | null;
  questionEndsAt: string | null;
  playerCount: number;
  questionCount: number;
};

export type HostState = {
  role: "host";
  serverNow: string;
  room: RoomSummary;
  players: RankedPlayer[];
  answerCount: number;
  question: PublicQuestion | RevealedQuestion | null;
};

export type PlayerSelf = {
  id: string;
  nickname: string;
  score: number;
  correctCount: number;
  rank: number;
  totalPlayers: number;
  hasAnsweredCurrent: boolean;
  myAnswerIndex: number | null;
  currentPointsAwarded: number | null;
  currentIsCorrect: boolean | null;
};

export type PlayerState = {
  role: "player";
  serverNow: string;
  room: RoomSummary;
  players: RankedPlayer[];
  me: PlayerSelf;
  question: PublicQuestion | RevealedQuestion | null;
};

export type RoomState = HostState | PlayerState;

export function isRevealedQuestion(
  question: PublicQuestion | RevealedQuestion | null,
): question is RevealedQuestion {
  return question !== null && "correctAnswerIndex" in question;
}

/** Neljän vastausvaihtoehdon väritunnisteet (0–3). */
export const ANSWER_SLOT_COUNT = 4;
