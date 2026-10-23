import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { getServerEnv } from "@/lib/env";

/**
 * Palvelinpuolen Supabase-client.
 *
 * Käyttää yksinomaan palvelinpuolen salaista avainta (SUPABASE_SERVICE_ROLE_KEY),
 * joka ohittaa RLS:n. Tätä clientiä ei koskaan saa tuoda client componentiin:
 * moduuli on suojattu `server-only`-paketilla, joten käännös epäonnistuu,
 * jos jokin selaimessa ajettava moduuli yrittää importata sen.
 *
 * Selain ei kosketa Supabaseen suoraan, vaan kaikki tieto kulkee
 * palvelinpuolen route handlerien kautta.
 */

let adminClient: SupabaseClient | null = null;

export function getSupabaseAdmin(): SupabaseClient {
  if (adminClient) {
    return adminClient;
  }

  const env = getServerEnv();

  adminClient = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
    global: {
      headers: { "x-client-info": "tietovisa-server" },
    },
  });

  return adminClient;
}

/** Testausta ja diagnostiikkaa varten. */
export function resetSupabaseAdmin(): void {
  adminClient = null;
}
