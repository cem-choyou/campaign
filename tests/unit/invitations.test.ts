import { describe, expect, it, vi } from "vitest";

vi.mock("@/env", () => ({ env: { AUTH_URL: "https://campaign.choyou-tools.fr/" } }));
vi.mock("@/server/db", () => ({ db: {} }));
vi.mock("@/server/email/send", () => ({ sendEmail: vi.fn() }));

const { invitationExpiry, invitationState, invitationUrl } = await import("@/server/invitations");
const { generateToken, hashToken } = await import("@/server/auth/tokens");

const now = new Date("2026-10-01T10:00:00Z");

describe("invitations", () => {
  it("expire after 7 days", () => {
    expect(invitationExpiry(now).toISOString()).toBe("2026-10-08T10:00:00.000Z");
  });

  it("computes the state", () => {
    const base = { expiresAt: invitationExpiry(now), acceptedAt: null, revokedAt: null };
    expect(invitationState(null, now)).toBe("unknown");
    expect(invitationState(base, now)).toBe("valid");
    expect(invitationState({ ...base, revokedAt: now }, now)).toBe("revoked");
    expect(invitationState({ ...base, acceptedAt: now }, now)).toBe("accepted");
    expect(invitationState(base, new Date("2026-10-08T10:00:00Z"))).toBe("expired");
  });

  it("builds the public link without a double slash", () => {
    expect(invitationUrl("abc")).toBe("https://campaign.choyou-tools.fr/invitation/abc");
  });

  it("uses random URL-safe tokens stored as SHA-256", () => {
    const token = generateToken();
    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(generateToken()).not.toBe(token);
    expect(hashToken(token)).toMatch(/^[a-f0-9]{64}$/);
    expect(hashToken(token)).toBe(hashToken(token));
  });
});
