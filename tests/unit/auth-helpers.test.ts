import { describe, expect, it, vi } from "vitest";
import { safeCallbackPath } from "@/lib/safe-redirect";

vi.mock("@/server/db", () => ({ db: {} }));
const { isAllowedGoogleEmail, normalizeEmail } = await import("@/server/auth/access");
const { rateLimit, resetRateLimits } = await import("@/server/rate-limit");

describe("safeCallbackPath", () => {
  it("keeps same-origin relative paths", () => {
    expect(safeCallbackPath("/it-for-business/campagnes?post=1")).toBe(
      "/it-for-business/campagnes?post=1",
    );
  });
  it("rejects absolute, protocol-relative and auth API URLs", () => {
    expect(safeCallbackPath("https://evil.example")).toBe("/");
    expect(safeCallbackPath("//evil.example")).toBe("/");
    expect(safeCallbackPath("/\\evil.example")).toBe("/");
    expect(safeCallbackPath("/api/auth/signout")).toBe("/");
    expect(safeCallbackPath(undefined, "/x")).toBe("/x");
  });
});

describe("Google domain restriction", () => {
  it("accepts only the configured Workspace domain", () => {
    expect(isAllowedGoogleEmail("Cem@ChoYou.fr", "choyou.fr")).toBe(true);
    expect(isAllowedGoogleEmail("someone@gmail.com", "choyou.fr")).toBe(false);
    expect(isAllowedGoogleEmail("x@notchoyou.fr", "choyou.fr")).toBe(false);
    expect(isAllowedGoogleEmail("x@choyou.fr.evil.com", "choyou.fr")).toBe(false);
    expect(isAllowedGoogleEmail(null, "choyou.fr")).toBe(false);
  });
  it("normalizes e-mails", () => {
    expect(normalizeEmail("  Anne.Laure@Example.FR ")).toBe("anne.laure@example.fr");
  });
});

describe("rateLimit", () => {
  it("blocks after the limit and resets after the window", () => {
    resetRateLimits();
    const t0 = 1_000_000;
    expect(rateLimit("k", 2, 1000, t0).ok).toBe(true);
    expect(rateLimit("k", 2, 1000, t0 + 1).ok).toBe(true);
    const blocked = rateLimit("k", 2, 1000, t0 + 2);
    expect(blocked).toEqual({ ok: false, retryAfterSec: 1 });
    expect(rateLimit("k", 2, 1000, t0 + 1001).ok).toBe(true);
  });
});
