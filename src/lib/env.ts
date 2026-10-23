import "server-only";

import { z } from "zod";

/**
 * Palvelinpuolen ympäristömuuttujat.
 *
 * HUOM: salaisuuksien arvoja ei koskaan kirjoiteta lokiin eikä palauteta
 * virheilmoituksissa. Virhe kertoo vain muuttujan nimen.
 */

function isHttpUrl(value: string): boolean {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "https:" || parsed.protocol === "http:";
  } catch {
    return false;
  }
}

/**
 * Ympäristömuuttujien nimet vaihtelevat asennustavan mukaan:
 *
 *  - Käsin asetettuna (tämä repo, .env.example):
 *    NEXT_PUBLIC_SUPABASE_URL ja SUPABASE_SERVICE_ROLE_KEY
 *  - Vercelin Supabase-integraatio asentaa samat arvot eri nimillä:
 *    SUPABASE_URL, NEXT_PUBLIC_SUPABASE_URL ja SUPABASE_SECRET_KEY
 *
 * Molemmat nimet luetaan, jotta sovellus toimii kummassakin tapauksessa.
 * Arvoja ei koskaan kirjoiteta lokiin eikä palauteta virheilmoituksissa.
 */
export function resolveSupabaseEnv(source: Record<string, string | undefined>): {
  url: string | undefined;
  serviceKey: string | undefined;
  anonKey: string | undefined;
} {
  const firstNonEmpty = (...values: (string | undefined)[]): string | undefined =>
    values.find((value) => typeof value === "string" && value.trim().length > 0);

  return {
    url: firstNonEmpty(source.NEXT_PUBLIC_SUPABASE_URL, source.SUPABASE_URL),
    serviceKey: firstNonEmpty(source.SUPABASE_SERVICE_ROLE_KEY, source.SUPABASE_SECRET_KEY),
    anonKey: firstNonEmpty(
      source.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      source.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
      source.SUPABASE_PUBLISHABLE_KEY,
    ),
  };
}

const serverEnvSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z
    .string()
    .trim()
    .min(1)
    .refine(isHttpUrl, { message: "NEXT_PUBLIC_SUPABASE_URL ei ole kelvollinen URL-osoite." }),
  SUPABASE_SERVICE_ROLE_KEY: z.string().trim().min(20),

  /**
   * Valinnainen juontajan tunnuslause.
   *
   * Jos tämä on asetettu, uuden pelin luominen vaatii saman tunnuslauseen.
   * Tarkoitettu julkisiin asennuksiin, joissa kuka tahansa voi löytää
   * sivuston. Tyhjä = luonti on avoin (oletus, sopii pikkujouluihin).
   *
   * SALAINEN: ei koskaan NEXT_PUBLIC_-etuliitettä.
   */
  HOST_PASSCODE: z.string().trim().min(4).max(128).optional(),

  /**
   * Julkinen avain on mukana yhteensopivuuden ja dokumentaation vuoksi.
   * Selain ei kuitenkaan keskustele Supabasen kanssa suoraan, joten sitä ei
   * vaadita ajonaikaisesti.
   */
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().trim().min(10).optional(),
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;

export class EnvConfigurationError extends Error {
  readonly missing: string[];

  constructor(missing: string[]) {
    super(
      `Supabase-ympäristömuuttujat puuttuvat tai ovat virheellisiä: ${missing.join(", ")}. ` +
        "Aseta ne tiedostoon .env.local (tai config/.env) ja käynnistä palvelin uudelleen. " +
        "Katso .env.example. Vercelin Supabase-integraatiota käytettäessä " +
        "SUPABASE_SECRET_KEY ja SUPABASE_URL kelpaavat myös.",
    );
    this.name = "EnvConfigurationError";
    this.missing = missing;
  }
}

let cachedEnv: ServerEnv | null = null;

export function getServerEnv(): ServerEnv {
  if (cachedEnv) {
    return cachedEnv;
  }

  const resolved = resolveSupabaseEnv(process.env);

  const parsed = serverEnvSchema.safeParse({
    NEXT_PUBLIC_SUPABASE_URL: resolved.url,
    SUPABASE_SERVICE_ROLE_KEY: resolved.serviceKey,
    HOST_PASSCODE: process.env.HOST_PASSCODE,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: resolved.anonKey,
  });

  if (!parsed.success) {
    const missing = [
      ...new Set(
        parsed.error.issues.map((issue) => String(issue.path[0] ?? "tuntematon")),
      ),
    ];
    throw new EnvConfigurationError(missing);
  }

  cachedEnv = parsed.data;
  return cachedEnv;
}

export function isSupabaseConfigured(): boolean {
  try {
    getServerEnv();
    return true;
  } catch {
    return false;
  }
}
