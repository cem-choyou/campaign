import { describe, expect, it, vi } from "vitest";

vi.stubEnv("AUTH_URL", "http://localhost:3000");
vi.stubEnv("AUTH_SECRET", "x".repeat(32));
vi.stubEnv("AUTH_GOOGLE_ID", "id");
vi.stubEnv("AUTH_GOOGLE_SECRET", "secret");
vi.stubEnv("DATABASE_URL", "postgresql://u:p@localhost:5433/db");

const { parseEnv } = await import("@/env");

const valid = {
  AUTH_URL: "https://campaign.choyou-tools.fr",
  AUTH_SECRET: "a".repeat(44),
  AUTH_GOOGLE_ID: "id",
  AUTH_GOOGLE_SECRET: "secret",
  DATABASE_URL: "postgresql://u:p@host/db",
};

describe("parseEnv", () => {
  it("applies defaults and turns empty optional values into undefined", () => {
    const env = parseEnv({ ...valid, RESEND_API_KEY: "" });
    expect(env.ALLOWED_GOOGLE_DOMAIN).toBe("choyou.fr");
    expect(env.AI_DAILY_LIMIT_PER_BRAND).toBe(300);
    expect(env.AI_MODEL).toBe("claude-sonnet-5");
    expect(env.AI_TRANSPORT).toBe("anthropic");
    expect(env.RESEND_API_KEY).toBeUndefined();
  });

  it("refuses to start with a clear message when a required variable is missing", () => {
    expect(() => parseEnv({ ...valid, AUTH_GOOGLE_ID: undefined })).toThrow(/AUTH_GOOGLE_ID/);
    expect(() => parseEnv({ ...valid, AUTH_SECRET: "short" })).toThrow(/AUTH_SECRET/);
  });
});
