// Pure campaign statistics (no database): shared by the list, the header and « Aujourd'hui ».

export type PostForStats = {
  status: string;
  scheduledAt: Date;
  platform: "LINKEDIN" | "YOUTUBE" | null;
};

export type CampaignStats = {
  total: number;
  published: number;
  approved: number;
  inReview: number;
  drafts: number;
  failed: number;
  /** Share of published posts, 0..1 (cancelled posts excluded). */
  progress: number;
  platforms: ("LINKEDIN" | "YOUTUBE")[];
  nextPostAt: Date | null;
};

export function campaignStats(posts: PostForStats[], now = new Date()): CampaignStats {
  const live = posts.filter((p) => p.status !== "CANCELLED");
  const count = (status: string) => live.filter((p) => p.status === status).length;
  const published = count("PUBLISHED");
  const upcoming = live
    .filter((p) => p.status !== "PUBLISHED" && p.scheduledAt >= now)
    .sort((a, b) => a.scheduledAt.getTime() - b.scheduledAt.getTime());
  const platforms = new Set(live.map((p) => p.platform).filter((p) => p !== null));

  return {
    total: live.length,
    published,
    approved: count("APPROVED") + count("PROCESSING"),
    inReview: count("IN_REVIEW"),
    drafts: count("DRAFT"),
    failed: count("FAILED"),
    progress: live.length === 0 ? 0 : published / live.length,
    platforms: (["LINKEDIN", "YOUTUBE"] as const).filter((p) => platforms.has(p)),
    nextPostAt: upcoming[0]?.scheduledAt ?? null,
  };
}

/** Whole days between two date-only values (UTC midnight). */
export function daysBetween(from: Date, to: Date): number {
  return Math.round((to.getTime() - from.getTime()) / 86_400_000);
}

/** Default name suggested by the wizard: « Campagne octobre 2026 ». */
export function suggestedCampaignName(now = new Date(), timeZone = "Europe/Paris"): string {
  const month = new Intl.DateTimeFormat("fr-FR", {
    month: "long",
    year: "numeric",
    timeZone,
  }).format(now);
  return `Campagne ${month}`;
}

/** Wizard progress: steps 1..4 are in progress, 5 means the wizard was completed. */
export const WIZARD_DONE = 5;
