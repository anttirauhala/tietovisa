import { describe, expect, it } from "vitest";

import { resolveSupabaseEnv } from "./env";

/**
 * Ympäristömuuttujien nimet vaihtelevat asennustavan mukaan. Nämä testit
 * varmistavat, että sekä käsin asetetut nimet että Vercelin
 * Supabase-integraation asentamat nimet kelpaavat.
 */
describe("Supabase-ympäristömuuttujien tunnistus", () => {
  it("lukee käsin asetetut nimet", () => {
    const resolved = resolveSupabaseEnv({
      NEXT_PUBLIC_SUPABASE_URL: "https://oma.supabase.co",
      SUPABASE_SERVICE_ROLE_KEY: "sb_secret_oma",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "sb_publishable_oma",
    });

    expect(resolved.url).toBe("https://oma.supabase.co");
    expect(resolved.serviceKey).toBe("sb_secret_oma");
    expect(resolved.anonKey).toBe("sb_publishable_oma");
  });

  it("lukee Vercelin Supabase-integraation asentamat nimet", () => {
    const resolved = resolveSupabaseEnv({
      SUPABASE_URL: "https://integraatio.supabase.co",
      NEXT_PUBLIC_SUPABASE_URL: "https://integraatio.supabase.co",
      SUPABASE_SECRET_KEY: "sb_secret_integraatio",
      SUPABASE_PUBLISHABLE_KEY: "sb_publishable_integraatio",
    });

    expect(resolved.url).toBe("https://integraatio.supabase.co");
    expect(resolved.serviceKey).toBe("sb_secret_integraatio");
    expect(resolved.anonKey).toBe("sb_publishable_integraatio");
  });

  it("suosii käsin asetettua nimeä, jos molemmat on asetettu", () => {
    const resolved = resolveSupabaseEnv({
      NEXT_PUBLIC_SUPABASE_URL: "https://oma.supabase.co",
      SUPABASE_URL: "https://integraatio.supabase.co",
      SUPABASE_SERVICE_ROLE_KEY: "sb_secret_oma",
      SUPABASE_SECRET_KEY: "sb_secret_integraatio",
    });

    expect(resolved.url).toBe("https://oma.supabase.co");
    expect(resolved.serviceKey).toBe("sb_secret_oma");
  });

  it("ohittaa tyhjät ja pelkät välilyönnit sisältävät arvot", () => {
    const resolved = resolveSupabaseEnv({
      NEXT_PUBLIC_SUPABASE_URL: "   ",
      SUPABASE_URL: "https://varalla.supabase.co",
      SUPABASE_SERVICE_ROLE_KEY: "",
      SUPABASE_SECRET_KEY: "sb_secret_varalla",
    });

    expect(resolved.url).toBe("https://varalla.supabase.co");
    expect(resolved.serviceKey).toBe("sb_secret_varalla");
  });

  it("palauttaa undefined, kun mitään ei ole asetettu", () => {
    const resolved = resolveSupabaseEnv({});

    expect(resolved.url).toBeUndefined();
    expect(resolved.serviceKey).toBeUndefined();
    expect(resolved.anonKey).toBeUndefined();
  });
});
