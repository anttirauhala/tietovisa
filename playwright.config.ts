import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright-asetukset kriittisten käyttäjäpolkujen testaamiseen.
 *
 * Testit ajetaan tuotantokäännöstä (`next start`) ja oikeaa Supabase-projektia
 * vasten. Testit luovat omat pelihuoneensa ja siivoavat ne lopuksi.
 *
 * HUOM: pelaajat testataan erillisillä selainkonteksteilla, joten jokaisella on
 * oma localStorage-tallennuksensa – aivan kuten oikeilla puhelimilla.
 */

const PORT = Number(process.env.E2E_PORT ?? 3210);
const BASE_URL = `http://127.0.0.1:${PORT}`;

export default defineConfig({
  testDir: "./e2e",
  timeout: 90_000,
  expect: { timeout: 20_000 },
  // Testit jakavat saman Supabase-projektin, joten ajetaan sarjassa.
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: [["list"]],
  use: {
    baseURL: BASE_URL,
    locale: "fi-FI",
    timezoneId: "Europe/Helsinki",
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } },
    },
  ],
  webServer: {
    command: `npx next start -p ${PORT}`,
    url: BASE_URL,
    reuseExistingServer: true,
    timeout: 120_000,
    stdout: "ignore",
    stderr: "pipe",
  },
});
