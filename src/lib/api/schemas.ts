import { z } from "zod";

/**
 * Palvelinpuolen pyyntöskeemat. Kaikki sisääntuleva data validoidaan Zodilla.
 */

export const NICKNAME_MIN_LENGTH = 2;
export const NICKNAME_MAX_LENGTH = 24;

/**
 * Nimimerkki: 2–24 merkkiä, vain tulostettavat kirjaimet, numerot ja
 * tavalliset välimerkit. Estää ohjausmerkit ja näkymättömät merkit.
 */
export const nicknameSchema = z
  .string()
  .trim()
  .min(NICKNAME_MIN_LENGTH, `Nimimerkin pitää olla vähintään ${NICKNAME_MIN_LENGTH} merkkiä.`)
  .max(NICKNAME_MAX_LENGTH, `Nimimerkki saa olla enintään ${NICKNAME_MAX_LENGTH} merkkiä.`)
  .regex(
    /^[\p{L}\p{N} _\-.'!?()]+$/u,
    "Nimimerkissä saa olla vain kirjaimia, numeroita ja tavallisia välimerkkejä.",
  );

export const pinSchema = z
  .string()
  .trim()
  .regex(/^[0-9]{6}$/, "Liittymiskoodin pitää olla kuusi numeroa.");

export const roomIdSchema = z.string().uuid("Pelihuoneen tunniste ei ole kelvollinen.");

/**
 * Uuden huoneen luonti. `passcode` vaaditaan vain, jos palvelimelle on
 * asetettu HOST_PASSCODE. Skeema hyväksyy sen aina, ja palvelin päättää
 * tarvitaanko sitä.
 */
export const createRoomRequestSchema = z.object({
  passcode: z.string().max(128, "Tunnuslause on liian pitkä.").optional(),
});

export const joinRoomRequestSchema = z.object({
  pin: pinSchema,
  nickname: nicknameSchema,
});

export const answerRequestSchema = z.object({
  questionIndex: z.number().int().min(0, "Kysymysindeksi ei ole kelvollinen."),
  answerIndex: z.number().int().min(0).max(3, "Vastausvaihtoehdon pitää olla välillä 0–3."),
});

export const advanceRequestSchema = z.object({});

export type JoinRoomRequest = z.infer<typeof joinRoomRequestSchema>;
export type AnswerRequest = z.infer<typeof answerRequestSchema>;
