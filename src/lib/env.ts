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

const serverEnvSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z
    .string()
    .trim()
    .min(1)
    .refine(isHttpUrl, { message: "NEXT_PUBLIC_SUPABASE_URL ei ole kelvollinen URL-osoite." }),
  SUPABASE_SERVICE_ROLE_KEY: z.string().trim().min(20),
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
        "Katso .env.example.",
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

  const parsed = serverEnvSchema.safeParse({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
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
