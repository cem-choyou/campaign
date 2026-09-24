// Shared e2e settings. The e2e database is the local Docker Postgres (docker-compose.dev.yml).

function nextMondayPlus(weeks: number): string {
  const d = new Date();
  const offset = (8 - d.getUTCDay()) % 7 || 7;
  d.setUTCDate(d.getUTCDate() + offset + weeks * 7);
  return d.toISOString().slice(0, 10);
}

export const E2E = {
  port: 3100,
  baseURL: process.env.E2E_BASE_URL ?? "http://localhost:3100",
  databaseUrl:
    process.env.E2E_DATABASE_URL ?? "postgresql://campaign:campaign@localhost:5433/campaign_e2e",
  /** Demo campaign starts two weeks from next Monday: every post is in the future. */
  demoStart: nextMondayPlus(2),
};

export const SESSIONS_FILE = "playwright/.auth/sessions.json";

export type Role = "admin" | "editor" | "client";
