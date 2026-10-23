import path from "node:path";

import { defineConfig } from "vitest/config";

const root = process.cwd();

export default defineConfig({
  resolve: {
    alias: {
      "@": path.join(root, "src"),
      /*
       * `server-only` estää palvelinmoduulien käytön selaimessa.
       * Vitestissä se korvataan tyhjällä moduulilla, jotta palvelinpuolen
       * puhdasta logiikkaa voidaan testata ilman selainta.
       */
      "server-only": path.join(root, "src/test/server-only-stub.ts"),
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    reporters: ["default"],
    /*
     * Tietokantaintegraatiotestit käynnistävät PGlite-instanssin (PostgreSQL
     * WebAssemblyssä) ja ajavat migraatiot, mikä kestää muutaman sekunnin.
     * Nostetaan aikarajat, jotta testit eivät ole alttiita hitaille
     * suoritusympäristöille.
     */
    testTimeout: 20_000,
    hookTimeout: 60_000,
  },
});
