import "server-only";

import { hashToken, hashesEqual } from "@/lib/tokens";

/**
 * Juontajan tunnuslause (HOST_PASSCODE).
 *
 * Uuden pelin luominen on oletuksena avointa: pelaajat ja juontaja pääsevät
 * aloittamaan ilman kirjautumista. Jos sivusto on julkinen, kuka tahansa
 * löytäjä voi kuitenkin luoda huoneita. Siksi luonti voidaan suojata
 * palvelimen ympäristömuuttujassa määritetyllä tunnuslauseella.
 *
 * Tunnuslause on SALAINEN: sitä ei koskaan aseteta NEXT_PUBLIC_-etuliitteellä
 * eikä palauteta virheilmoituksissa. Vertailu tehdään vakioaikaisesti
 * tiivisteitä vertaamalla, jottei sitä voi arvata ajoituksesta.
 */

export type PasscodeCheck =
  | { ok: true }
  | { ok: false; reason: "required" | "invalid" };

/**
 * Puhdas tarkistus ilman ympäristömuuttujien lukemista, joten se on helppo
 * testata. `expected` tulee palvelimen asetuksista.
 */
export function verifyHostPasscode(
  provided: unknown,
  expected: string | undefined,
): PasscodeCheck {
  // Tunnuslausetta ei ole asetettu → luonti on avointa.
  if (!expected) {
    return { ok: true };
  }

  if (typeof provided !== "string" || provided.trim().length === 0) {
    return { ok: false, reason: "required" };
  }

  /*
   * Palvelimen arvo on jo trimmattu skeemassa (env.ts), joten myös syöte
   * trimmataan. Muuten esimerkiksi puhelimen automaattitäytön tai
   * liittämisen mukana tullut välilyönti hylkäisi oikean tunnuslauseen.
   * Vain reunan välilyönnit sivuutetaan – välissä olevat merkitsevät.
   */
  const normalized = provided.trim();

  return hashesEqual(hashToken(expected), hashToken(normalized))
    ? { ok: true }
    : { ok: false, reason: "invalid" };
}

export function passcodeErrorMessage(reason: "required" | "invalid"): string {
  return reason === "required"
    ? "Juontajan tunnuslause puuttuu."
    : "Väärä juontajan tunnuslause. Tarkista palvelimen HOST_PASSCODE – myös kirjainkoko ja lainausmerkit merkitsevät.";
}
