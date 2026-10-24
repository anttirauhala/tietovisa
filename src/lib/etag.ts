import { createHash } from "node:crypto";

/**
 * Pelitilan ETag-tunniste (vaihe 2b).
 *
 * Tilakysely toistuu noin sekunnin välein. Tunnisteen avulla selain voi
 * kysyä tilaa ehdollisesti (If-None-Match) ja palvelin voi vastata
 * 304 Not Modified ilman runkoa, kun tila on ennallaan.
 *
 * Tunniste lasketaan tilan sisällöstä, ei tietokannan updated_at-sarakkeesta.
 * Se on tarkoituellista: sama tila tuottaa aina saman tunnisteen riippumatta
 * siitä, kumpi rooli sitä kysyy, eikä tunnisteeseen tarvita uutta
 * tietokantakenttää tai laskuria.
 *
 * Tämä moduuli on puhdas ja sitä voi testata ilman selainta.
 */

/**
 * Kentät, jotka eivät ole pelin tilaa vaan kellon apuarvoja.
 * serverNow muuttuu joka pyynnöllä, joten sen pitää jäädä tunnisteen
 * ulkopuolelle – muuten 304-vastausta ei syntyisi koskaan.
 */
const VOLATILE_FIELDS: readonly string[] = ["serverNow"];

/** Heikko ETag -muoto: W/"<22 merkin tiiviste>". */
export function stateEtag(state: object): string {
  const source = state as Record<string, unknown>;
  const canonical: Record<string, unknown> = {};

  // Kenttien järjestys normalisoidaan, jotta sama sisältö tuottaa saman
  // tunnisteen riippumatta olion muodostusjärjestyksestä.
  for (const key of Object.keys(source).sort()) {
    if (VOLATILE_FIELDS.includes(key)) {
      continue;
    }
    canonical[key] = source[key];
  }

  const digest = createHash("sha256").update(JSON.stringify(canonical)).digest("base64url");
  return `W/"${digest.slice(0, 22)}"`;
}

/**
 * If-None-Match-otsikon vertailu ETag-tunnisteeseen.
 *
 * Tukee useita pilkulla eroteltuja arvoja, jokerimerkkiä (*) ja heikkoa
 * vertailua (W/-etuliite sivuutetaan), kuten HTTP-spesifikaatio edellyttää.
 */
export function matchesEtag(ifNoneMatch: string | null, etag: string): boolean {
  if (!ifNoneMatch) {
    return false;
  }

  const target = stripWeak(etag);

  return ifNoneMatch
    .split(",")
    .map((candidate) => candidate.trim())
    .some((candidate) => candidate === "*" || stripWeak(candidate) === target);
}

function stripWeak(value: string): string {
  return value.startsWith("W/") ? value.slice(2) : value;
}
