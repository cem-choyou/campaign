import { describe, expect, it, vi } from "vitest";

vi.mock("@/env", () => ({
  env: { DATABASE_URL: "postgresql://u:p@localhost:5433/db", NODE_ENV: "test" },
}));

const { isTransientDbError } = await import("@/server/db");

describe("isTransientDbError", () => {
  it("detects Neon wake-up errors", () => {
    expect(
      isTransientDbError(new Error("terminating connection due to administrator command (57P01)")),
    ).toBe(true);
    expect(isTransientDbError(new Error("Connection terminated unexpectedly"))).toBe(true);
  });
  it("ignores regular errors", () => {
    expect(isTransientDbError(new Error("Unique constraint failed"))).toBe(false);
    expect(isTransientDbError("57P01")).toBe(false);
  });
});
