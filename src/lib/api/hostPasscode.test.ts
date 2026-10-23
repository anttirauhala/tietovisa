import { describe, expect, it } from "vitest";

import { passcodeErrorMessage, verifyHostPasscode } from "./hostPasscode";

/**
 * Juontajan tunnuslauseen tarkistus. Kun HOST_PASSCODE ei ole asetettu,
 * luonti on avointa – tämä on oletus pikkujoulukäytössä.
 */
describe("juontajan tunnuslause", () => {
  it("päästää läpi, kun tunnuslausetta ei ole asetettu palvelimelle", () => {
    expect(verifyHostPasscode(undefined, undefined)).toEqual({ ok: true });
    expect(verifyHostPasscode("", undefined)).toEqual({ ok: true });
    expect(verifyHostPasscode("mitä tahansa", undefined)).toEqual({ ok: true });
    expect(verifyHostPasscode(123, undefined)).toEqual({ ok: true });
  });

  it("vaatii tunnuslauseen, kun se on asetettu", () => {
    expect(verifyHostPasscode(undefined, "salainen")).toEqual({ ok: false, reason: "required" });
    expect(verifyHostPasscode("", "salainen")).toEqual({ ok: false, reason: "required" });
    expect(verifyHostPasscode("   ", "salainen")).toEqual({ ok: false, reason: "required" });
    expect(verifyHostPasscode(42, "salainen")).toEqual({ ok: false, reason: "required" });
    expect(verifyHostPasscode({ value: "salainen" }, "salainen")).toEqual({
      ok: false,
      reason: "required",
    });
  });

  it("hyväksyy oikean tunnuslauseen", () => {
    expect(verifyHostPasscode("salainen", "salainen")).toEqual({ ok: true });
    expect(verifyHostPasscode("pikkujoulu-2026", "pikkujoulu-2026")).toEqual({ ok: true });
  });

  it("hylkää väärän tunnuslauseen", () => {
    expect(verifyHostPasscode("väärä", "salainen")).toEqual({ ok: false, reason: "invalid" });
    expect(verifyHostPasscode("salaine", "salainen")).toEqual({ ok: false, reason: "invalid" });
    expect(verifyHostPasscode("salainen ", "salainen")).toEqual({ ok: false, reason: "invalid" });
    // Kirjainkoko on merkitsevä.
    expect(verifyHostPasscode("SALAINEN", "salainen")).toEqual({ ok: false, reason: "invalid" });
  });

  it("ei paljasta tunnuslausetta virheilmoituksessa", () => {
    const message = passcodeErrorMessage("invalid");

    expect(message).not.toContain("salainen");
    expect(message.toLowerCase()).toContain("tunnuslause");
  });
});
