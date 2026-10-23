import "server-only";

import rawQuestions from "@/data/questions.json";

import type { PublicQuestion, RevealedQuestion } from "@/lib/game/types";
import { calculatePoints, timeLimitToMs } from "@/lib/game/scoring";
import { formatQuestionIssues, questionsSchema, type Question } from "./schema";

export { questionSchema, questionsSchema } from "./schema";
export type { Question } from "./schema";

/**
 * Palvelinpuolen kysymysmoduuli.
 *
 * Tämä moduuli sisältää vastausavaimen, joten sitä EI SAA tuoda client
 * componentiin. `server-only`-importti varmistaa, että käännös epäonnistuu,
 * jos jokin selaimessa ajettava moduuli yrittää käyttää tätä.
 *
 * Julkinen muoto kysymyksestä rakennetaan funktioilla toPublicQuestion ja
 * toRevealedQuestion: oikea vastaus lähetetään selaimelle vain tulosvaiheessa.
 */

export function parseQuestions(input: unknown): Question[] {
  const parsed = questionsSchema.safeParse(input);

  if (!parsed.success) {
    throw new Error(
      `Kysymystiedosto src/data/questions.json on virheellinen:\n${formatQuestionIssues(parsed.error)}`,
    );
  }

  return parsed.data;
}

export const QUESTIONS: readonly Question[] = parseQuestions(rawQuestions);

export function getQuestionCount(): number {
  return QUESTIONS.length;
}

export function hasQuestionAt(index: number): boolean {
  return Number.isInteger(index) && index >= 0 && index < QUESTIONS.length;
}

export function getQuestionAt(index: number): Question {
  if (!hasQuestionAt(index)) {
    throw new Error(`Kysymystä indeksillä ${index} ei ole olemassa.`);
  }
  return QUESTIONS[index];
}

export function toPublicQuestion(index: number): PublicQuestion {
  const question = getQuestionAt(index);
  return {
    index,
    total: getQuestionCount(),
    category: question.category,
    question: question.question,
    answers: [...question.answers],
    timeLimitSeconds: question.timeLimitSeconds,
    points: question.points,
  };
}

export function toRevealedQuestion(index: number, distribution: number[]): RevealedQuestion {
  const question = getQuestionAt(index);
  return {
    ...toPublicQuestion(index),
    correctAnswerIndex: question.correctAnswerIndex,
    distribution,
  };
}

/** Palauttaa oikean vastauksen indeksin. Vain palvelinpuolen käyttöön. */
export function getCorrectAnswerIndex(index: number): number {
  return getQuestionAt(index).correctAnswerIndex;
}

export function isAnswerCorrect(questionIndex: number, answerIndex: number): boolean {
  return getCorrectAnswerIndex(questionIndex) === answerIndex;
}

/** Palvelinpuolen pisteytys yhdelle vastaukselle. */
export function scoreAnswer(questionIndex: number, answerIndex: number, elapsedMs: number): number {
  const question = getQuestionAt(questionIndex);
  return calculatePoints({
    isCorrect: question.correctAnswerIndex === answerIndex,
    elapsedMs,
    timeLimitMs: timeLimitToMs(question.timeLimitSeconds),
    maxPoints: question.points,
  });
}

export function getQuestionTimeLimitMs(index: number): number {
  return timeLimitToMs(getQuestionAt(index).timeLimitSeconds);
}

export function getQuestionMaxPoints(index: number): number {
  return getQuestionAt(index).points;
}

/** Kysymysluettelon kategoriat (käytetään vain palvelimella). */
export function getCategories(): string[] {
  return [...new Set(QUESTIONS.map((question) => question.category))];
}
