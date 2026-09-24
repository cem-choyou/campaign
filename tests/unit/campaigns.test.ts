import { describe, expect, it } from "vitest";
import { campaignStats, daysBetween, suggestedCampaignName } from "@/lib/campaigns";
import { parseDateOnly } from "@/lib/dates";
import { campaignDraftSchema } from "@/lib/validations/campaign";

const now = new Date("2026-10-06T08:00:00Z");
const at = (iso: string) => new Date(iso);

describe("campaignStats", () => {
  it("counts statuses, progress, channels and the next post", () => {
    const stats = campaignStats(
      [
        { status: "PUBLISHED", scheduledAt: at("2026-10-05T07:00:00Z"), platform: "LINKEDIN" },
        { status: "APPROVED", scheduledAt: at("2026-10-08T07:00:00Z"), platform: "YOUTUBE" },
        { status: "DRAFT", scheduledAt: at("2026-10-07T07:00:00Z"), platform: "LINKEDIN" },
        { status: "CANCELLED", scheduledAt: at("2026-10-06T07:00:00Z"), platform: "LINKEDIN" },
      ],
      now,
    );
    expect(stats).toMatchObject({ total: 3, published: 1, approved: 1, drafts: 1 });
    expect(stats.progress).toBeCloseTo(1 / 3);
    expect(stats.platforms).toEqual(["LINKEDIN", "YOUTUBE"]);
    expect(stats.nextPostAt?.toISOString()).toBe("2026-10-07T07:00:00.000Z");
  });

  it("handles an empty campaign", () => {
    expect(campaignStats([], now)).toMatchObject({ total: 0, progress: 0, nextPostAt: null });
  });
});

describe("duplication helpers", () => {
  it("computes the shift in days between two start Mondays", () => {
    expect(daysBetween(parseDateOnly("2026-10-05"), parseDateOnly("2027-01-04"))).toBe(91);
    expect(daysBetween(parseDateOnly("2026-10-05"), parseDateOnly("2026-09-28"))).toBe(-7);
  });

  it("suggests a monthly name", () => {
    expect(suggestedCampaignName(new Date("2026-10-15T10:00:00Z"))).toBe("Campagne octobre 2026");
  });
});

describe("campaignDraftSchema", () => {
  it("accepts partial autosaves and empty dates", () => {
    const parsed = campaignDraftSchema.parse({ campaignId: "c1", objective: "", startDate: "" });
    expect(parsed).toMatchObject({ campaignId: "c1", objective: null, startDate: null });
  });

  it("rejects an empty name and an end before the start", () => {
    expect(campaignDraftSchema.safeParse({ campaignId: "c1", name: "  " }).success).toBe(false);
    const res = campaignDraftSchema.safeParse({
      campaignId: "c1",
      startDate: "2026-10-05",
      endDate: "2026-10-01",
    });
    expect(res.success).toBe(false);
  });
});
