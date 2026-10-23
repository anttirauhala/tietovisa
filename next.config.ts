import path from "node:path";

import { loadEnvConfig } from "@next/env";
import type { NextConfig } from "next";

/*
 * Next.js lukee .env-tiedostot projektin juuresta (.env.local jne.).
 * Tässä projektissa salaisuudet voivat olla myös config/-hakemistossa,
 * joten se ladataan erikseen. Arvoja ei tulosteta eikä lokiteta.
 *
 * HUOM: tiedostot on mainittu .gitignoressa – salaisuuksia ei viedä
 * versionhallintaan.
 */
loadEnvConfig(path.join(process.cwd(), "config"), process.env.NODE_ENV !== "production");

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
