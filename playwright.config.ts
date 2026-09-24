import { defineConfig, devices } from "@playwright/test";
import { E2E } from "./tests/e2e/config";

// e2e runs against a production build on port 3100 and the local `campaign_e2e` database
// (docker compose -f docker-compose.dev.yml up -d). The database is reset by global-setup.

export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  timeout: 45_000,
  expect: { timeout: 10_000 },
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: E2E.baseURL,
    locale: "fr-FR",
    timezoneId: "Europe/Paris",
    trace: "retain-on-failure",
  },
  globalSetup: "./tests/e2e/global-setup.ts",
  projects: [
    {
      name: "desktop",
      testIgnore: [/screenshots\.spec\.ts/, /mobile\.spec\.ts/],
      use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } },
    },
    {
      name: "mobile",
      testMatch: /mobile\.spec\.ts/,
      use: { ...devices["Pixel 7"], viewport: { width: 390, height: 844 } },
    },
    {
      name: "screenshots",
      testMatch: /screenshots\.spec\.ts/,
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: `npm run build && npx next start -p ${E2E.port}`,
        url: `${E2E.baseURL}/connexion`,
        timeout: 400_000,
        reuseExistingServer: !process.env.CI,
        env: {
          DATABASE_URL: E2E.databaseUrl,
          DIRECT_URL: E2E.databaseUrl,
          AUTH_URL: E2E.baseURL,
          RESEND_API_KEY: "",
          EMAIL_TRANSPORT: "log",
          AI_TRANSPORT: "mock",
          AI_DAILY_LIMIT_PER_BRAND: "300",
        },
      },
});
