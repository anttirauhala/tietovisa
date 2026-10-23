import { describe, expect, it } from "vitest";

import {
  getQuestionAt,
  getQuestionCount,
  hasQuestionAt,
  isAnswerCorrect,
  parseQuestions,
  QUESTIONS,
  scoreAnswer,
  toPublicQuestion,
  toRevealedQuestion,
} from "./index";
import { questionSchema, questionsSchema } from "./schema";

const validQuestion = {
  id: "q-test",
  category: "Yleistieto",
  question: "Mikä on testikysymys?",
  answers: ["A", "B", "C", "D"],
  correctAnswerIndex: 2,
  timeLimitSeconds: 20,
  points: 1000,
};

describe("kysymysten JSON-skeema", () => {
  it("hyväksyy kelvollisen kysymyksen", () => {
    expect(questionSchema.safeParse(validQuestion).success).toBe(true);
  });

  it("vaatii täsmälleen neljä erillistä vastausvaihtoehtoa", () => {
    expect(
      questionSchema.safeParse({ ...validQuestion, answers: ["A", "B", "C"] }).success,
    ).toBe(false);
    expect(
      questionSchema.safeParse({ ...validQuestion, answers: ["A", "B", "C", "D", "E"] }).success,
    ).toBe(false);
    expect(
      questionSchema.safeParse({ ...validQuestion, answers: ["A", "B", "C", "C"] }).success,
    ).toBe(false);
  });

  it("vaatii kelvollisen oikean vastauksen indeksin", () => {
    expect(
      questionSchema.safeParse({ ...validQuestion, correctAnswerIndex: -1 }).success,
    ).toBe(false);
    expect(
      questionSchema.safeParse({ ...validQuestion, correctAnswerIndex: 4 }).success,
    ).toBe(false);
    expect(
      questionSchema.safeParse({ ...validQuestion, correctAnswerIndex: 1.5 }).success,
    ).toBe(false);
  });

  it("vaatii kelvollisen aikarajan ja maksimipistemäärän", () => {
    expect(questionSchema.safeParse({ ...validQuestion, timeLimitSeconds: 0 }).success).toBe(
      false,
    );
    expect(questionSchema.safeParse({ ...validQuestion, timeLimitSeconds: 999 }).success).toBe(
      false,
    );
    expect(questionSchema.safeParse({ ...validQuestion, points: 0 }).success).toBe(false);
    expect(questionSchema.safeParse({ ...validQuestion, points: 99_999 }).success).toBe(false);
  });

  it("vaatii tunnisteen ja ei-tyhjän kysymystekstin", () => {
    expect(questionSchema.safeParse({ ...validQuestion, id: "" }).success).toBe(false);
    expect(questionSchema.safeParse({ ...validQuestion, question: "   " }).success).toBe(false);
  });

  it("estää kaksinkertaiset tunnisteet koko listassa", () => {
    const result = questionsSchema.safeParse([validQuestion, validQuestion]);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((issue) => issue.message.includes("useammin kuin kerran"))).toBe(
        true,
      );
    }
  });

  it("antaa selkeän virheen virheellisestä datasta", () => {
    expect(() => parseQuestions([{ id: "rikki" }])).toThrow(/virheellinen/i);
    expect(() => parseQuestions("ei taulukko")).toThrow();
  });
});

describe("kysymystiedosto src/data/questions.json", () => {
  it("sisältää vähintään 20 kysymystä", () => {
    expect(getQuestionCount()).toBeGreaterThanOrEqual(20);
  });

  it("läpäisee skeemavalidonnin", () => {
    expect(questionsSchema.safeParse(QUESTIONS).success).toBe(true);
  });

  it("sisältää useita kategorioita", () => {
    const categories = new Set(QUESTIONS.map((question) => question.category));
    expect(categories.size).toBeGreaterThanOrEqual(5);
  });

  it("hakee kysymyksen indeksillä ja tunnistaa rajat", () => {
    expect(hasQuestionAt(0)).toBe(true);
    expect(hasQuestionAt(getQuestionCount())).toBe(false);
    expect(() => getQuestionAt(-1)).toThrow();
    expect(getQuestionAt(0).id).toBe("q01");
  });
});

describe("julkinen kysymysmuoto", () => {
  it("ei sisällä oikeaa vastausta ennen tulosvaihetta", () => {
    for (let index = 0; index < getQuestionCount(); index += 1) {
      const publicQuestion = toPublicQuestion(index);

      expect("correctAnswerIndex" in publicQuestion).toBe(false);
      expect(JSON.stringify(publicQuestion)).not.toContain("correctAnswerIndex");
      expect(publicQuestion.answers).toHaveLength(4);
      expect(publicQuestion.index).toBe(index);
      expect(publicQuestion.total).toBe(getQuestionCount());
    }
  });

  it("paljastaa oikean vastauksen vain tulosmuodossa", () => {
    const revealed = toRevealedQuestion(0, [1, 2, 3, 4]);

    expect(revealed.correctAnswerIndex).toBe(getQuestionAt(0).correctAnswerIndex);
    expect(revealed.distribution).toEqual([1, 2, 3, 4]);
  });
});

describe("palvelinpuolen pisteytys kysymykselle", () => {
  it("tunnistaa oikean vastauksen", () => {
    const correct = getQuestionAt(0).correctAnswerIndex;

    expect(isAnswerCorrect(0, correct)).toBe(true);
    expect(isAnswerCorrect(0, (correct + 1) % 4)).toBe(false);
  });

  it("antaa väärästä vastauksesta nolla pistettä", () => {
    const correct = getQuestionAt(0).correctAnswerIndex;
    expect(scoreAnswer(0, (correct + 1) % 4, 100)).toBe(0);
  });

  it("antaa oikeasta vastauksesta pisteitä, jotka laskevat ajan myötä", () => {
    const correct = getQuestionAt(0).correctAnswerIndex;
    const fast = scoreAnswer(0, correct, 0);
    const slow = scoreAnswer(0, correct, 19_000);

    expect(fast).toBeGreaterThan(0);
    expect(fast).toBeGreaterThanOrEqual(slow);
    expect(fast).toBeLessThanOrEqual(getQuestionAt(0).points);
  });

  it("antaa nolla pistettä aikarajan jälkeen", () => {
    const question = getQuestionAt(0);
    const correct = question.correctAnswerIndex;

    expect(scoreAnswer(0, correct, question.timeLimitSeconds * 1000 + 1)).toBe(0);
  });
});
