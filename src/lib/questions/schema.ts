import { z } from "zod";

/**
 * Kysymysten Zod-skeema. JSON on ainoa kysymysten lähde.
 * Validointi epäonnistuu selkeästi, jos data on virheellistä.
 */

export const ANSWER_OPTION_COUNT = 4;

export const questionObjectSchema = z.object({
  id: z.string().trim().min(1, "Kysymyksellä pitää olla tunniste."),
  category: z.string().trim().min(1, "Kysymyksellä pitää olla kategoria."),
  question: z.string().trim().min(5, "Kysymysteksti ei saa olla tyhjä."),
  answers: z
    .array(z.string().trim().min(1, "Vastausvaihtoehto ei saa olla tyhjä."))
    .length(ANSWER_OPTION_COUNT, `Kysymyksessä pitää olla täsmälleen ${ANSWER_OPTION_COUNT} vastausvaihtoehtoa.`),
  correctAnswerIndex: z
    .number()
    .int("Oikean vastauksen indeksin pitää olla kokonaisluku.")
    .min(0, "Oikean vastauksen indeksin pitää olla vähintään 0.")
    .max(ANSWER_OPTION_COUNT - 1, "Oikean vastauksen indeksin pitää olla enintään 3."),
  timeLimitSeconds: z
    .number()
    .int("Aikarajan pitää olla kokonaisluku.")
    .min(5, "Aikarajan pitää olla vähintään 5 sekuntia.")
    .max(120, "Aikaraja saa olla enintään 120 sekuntia."),
  points: z
    .number()
    .int("Maksimipistemäärän pitää olla kokonaisluku.")
    .min(100, "Maksimipistemäärän pitää olla vähintään 100.")
    .max(5000, "Maksimipistemäärä saa olla enintään 5000."),
});

/**
 * Yksittäisen kysymyksen skeema. Vastausvaihtoehtojen pitää olla erillisiä.
 */
export const questionSchema = questionObjectSchema.superRefine((question, ctx) => {
  const normalized = question.answers.map((answer) => answer.toLocaleLowerCase("fi-FI"));
  if (new Set(normalized).size !== normalized.length) {
    ctx.addIssue({
      code: "custom",
      path: ["answers"],
      message: `Kysymyksessä "${question.id}" on samoja vastausvaihtoehtoja.`,
    });
  }
});

export type Question = z.infer<typeof questionObjectSchema>;

export const questionsSchema = z
  .array(questionSchema)
  .min(1, "Kysymyslistan pitää sisältää vähintään yksi kysymys.")
  .superRefine((questions, ctx) => {
    const seenIds = new Set<string>();
    questions.forEach((question, index) => {
      if (seenIds.has(question.id)) {
        ctx.addIssue({
          code: "custom",
          path: [index, "id"],
          message: `Kysymystunniste "${question.id}" esiintyy useammin kuin kerran.`,
        });
      }
      seenIds.add(question.id);
    });
  });

export function formatQuestionIssues(error: z.ZodError): string {
  return error.issues
    .map((issue) => {
      const location = issue.path.length > 0 ? issue.path.join(".") : "(juuri)";
      return `${location}: ${issue.message}`;
    })
    .join("\n");
}
