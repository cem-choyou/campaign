import { describe, expect, it } from "vitest";
import {
  type PostAction,
  type PostStatus,
  type TransitionContext,
  checkSchedule,
  decodePublisher,
  encodePublisher,
  isComplete,
  isFormatAllowed,
  linkedinFold,
  publisherOf,
  touchesApprovedContent,
  transition,
} from "@/lib/posts";

const kit: TransitionContext = { mode: "KIT", campaignActive: true, attempts: 0 };
const auto: TransitionContext = { mode: "AUTO", campaignActive: true, attempts: 0 };
const studio: TransitionContext = { mode: "STUDIO", campaignActive: true, attempts: 0 };

const ok = (from: PostStatus, action: PostAction, ctx = kit) => {
  const r = transition(from, action, ctx);
  return r.ok ? r.status : `DENIED`;
};

describe("post state machine (§6.3)", () => {
  it("follows the validation path", () => {
    expect(ok("DRAFT", "submit")).toBe("IN_REVIEW");
    expect(ok("IN_REVIEW", "approve")).toBe("APPROVED");
    expect(ok("IN_REVIEW", "reject")).toBe("DRAFT");
  });

  it("refuses shortcuts", () => {
    expect(ok("DRAFT", "approve")).toBe("DENIED");
    expect(ok("APPROVED", "submit")).toBe("DENIED");
    expect(ok("DRAFT", "reject")).toBe("DENIED");
  });

  it("sends an edited approved post back to draft, keeps other states, locks published ones", () => {
    expect(ok("APPROVED", "edit")).toBe("DRAFT");
    expect(ok("DRAFT", "edit")).toBe("DRAFT");
    expect(ok("IN_REVIEW", "edit")).toBe("IN_REVIEW");
    expect(ok("PROCESSING", "edit")).toBe("DENIED");
    expect(ok("PUBLISHED", "edit")).toBe("DENIED");
  });

  it("lets n8n claim only AUTO approved posts of an active campaign", () => {
    expect(ok("APPROVED", "claim", auto)).toBe("PROCESSING");
    expect(ok("APPROVED", "claim", kit)).toBe("DENIED");
    expect(ok("APPROVED", "claim", { ...auto, campaignActive: false })).toBe("DENIED");
  });

  it("retries twice then fails on the third error, and can be relaunched", () => {
    expect(transition("PROCESSING", "publish_failure", { ...auto, attempts: 0 })).toEqual({
      ok: true,
      status: "APPROVED",
      attempts: 1,
    });
    expect(transition("PROCESSING", "publish_failure", { ...auto, attempts: 2 })).toEqual({
      ok: true,
      status: "FAILED",
      attempts: 3,
    });
    expect(ok("PROCESSING", "publish_success", auto)).toBe("PUBLISHED");
    expect(ok("FAILED", "retry", auto)).toBe("APPROVED");
  });

  it("publishes STUDIO and KIT posts on confirmation", () => {
    expect(ok("APPROVED", "studio_published", studio)).toBe("PUBLISHED");
    expect(ok("APPROVED", "studio_published", kit)).toBe("DENIED");
    expect(ok("APPROVED", "kit_confirmed", kit)).toBe("PUBLISHED");
  });

  it("cancels anything but a published post", () => {
    for (const s of ["DRAFT", "IN_REVIEW", "APPROVED", "PROCESSING", "FAILED"] as PostStatus[]) {
      expect(ok(s, "cancel")).toBe("CANCELLED");
    }
    expect(ok("PUBLISHED", "cancel")).toBe("DENIED");
  });
});

describe("scheduling rules", () => {
  const now = new Date("2026-10-05T07:00:00Z");
  it("refuses past dates and warns under one hour", () => {
    expect(checkSchedule(new Date("2026-10-05T06:59:00Z"), now)).toEqual({
      ok: false,
      reason: "PAST",
    });
    expect(checkSchedule(new Date("2026-10-05T07:30:00Z"), now)).toEqual({
      ok: true,
      warning: "SOON",
    });
    expect(checkSchedule(new Date("2026-10-05T09:00:00Z"), now)).toEqual({ ok: true });
  });
});

describe("post helpers", () => {
  it("encodes and decodes the publisher (account XOR contributor)", () => {
    expect(decodePublisher(encodePublisher({ kind: "contributor", id: "c1" }))).toEqual({
      kind: "contributor",
      id: "c1",
    });
    expect(decodePublisher("page:x")).toBeNull();
    expect(publisherOf({ socialAccountId: "a", authorContributorId: null })).toEqual({
      kind: "account",
      id: "a",
    });
    expect(publisherOf({ socialAccountId: "a", authorContributorId: "c" })).toBeNull();
    expect(publisherOf({ socialAccountId: null, authorContributorId: null })).toBeNull();
  });

  it("knows which formats fit a platform", () => {
    expect(isFormatAllowed("LINKEDIN", "VIDEO_POST")).toBe(true);
    expect(isFormatAllowed("LINKEDIN", "SHORT")).toBe(false);
    expect(isFormatAllowed("YOUTUBE", "SHORT")).toBe(true);
  });

  it("detects changes that require a new validation", () => {
    expect(touchesApprovedContent({ body: "x" })).toBe(true);
    expect(touchesApprovedContent({ angle: "x", relatedVideoAdded: true })).toBe(false);
  });

  it("checks completeness before submission", () => {
    expect(isComplete({ format: "VIDEO_POST", body: "  ", youtubeTitle: null })).toBe(false);
    expect(isComplete({ format: "SHORT", body: null, youtubeTitle: "Titre" })).toBe(true);
  });
});

describe("linkedinFold", () => {
  it("keeps short texts whole", () => {
    expect(linkedinFold("Bonjour")).toEqual({ visible: "Bonjour", truncated: false });
  });
  it("cuts long texts on a word before the fold", () => {
    const text = "mot ".repeat(100).trim();
    const { visible, truncated } = linkedinFold(text, 210);
    expect(truncated).toBe(true);
    expect(visible.length).toBeLessThanOrEqual(210);
    expect(visible.endsWith("mot")).toBe(true);
  });
  it("cuts after three lines", () => {
    expect(linkedinFold("a\nb\nc\nd")).toEqual({ visible: "a\nb\nc", truncated: true });
  });
});
