import "server-only";

import { ApiError } from "@/lib/api/errors";
import type { AnswerRejectionReason } from "@/lib/game/answerValidation";
import { answerRejectionMessage } from "@/lib/game/answerValidation";

/**
 * Tietokantavirheiden muunnos käyttäjälle turvallisiksi API-virheiksi.
 * Raakaa SQL-virhettä ei koskaan palauteta selaimelle.
 */

export function mapDatabaseError(error: { code?: string; message?: string } | null): ApiError {
  if (!error) {
    return new ApiError(500, "server_error");
  }

  const code = error.code ?? "";

  // Tauluja tai funktioita ei ole vielä luotu → kerrotaan käyttäjälle mitä pitää tehdä.
  // PGRST205 = taulua ei löydy, PGRST202 = funktiota ei löydy,
  // 42P01 = undefined_table, 42883 = undefined_function.
  if (
    code === "PGRST205" ||
    code === "PGRST202" ||
    code === "42P01" ||
    code === "42883"
  ) {
    return new ApiError(
      503,
      "not_configured",
      "Tietokantataulut puuttuvat. Aja tiedostot supabase/migrations/*.sql Supabasen SQL-editorissa.",
    );
  }

  console.error("[tietovisa] tietokantavirhe:", code || error.message || "tuntematon");
  return new ApiError(500, "server_error");
}

/** Vastauksen hylkäämisen syy → HTTP-virhe. */
export function apiErrorFromAnswerReason(reason: AnswerRejectionReason): ApiError {
  const message = answerRejectionMessage(reason);

  switch (reason) {
    case "room_not_found":
      return new ApiError(404, "not_found", message);
    case "player_not_in_room":
      return new ApiError(401, "invalid_token", message);
    case "invalid_answer_index":
      return new ApiError(400, "invalid_request", message);
    case "already_answered":
      return new ApiError(409, "conflict", message);
    case "late":
      return new ApiError(409, "late", message);
    default:
      return new ApiError(409, "invalid_state", message);
  }
}
