import "server-only";
import { campaignStats } from "@/lib/campaigns";
import { formatDateOnly, localToUtc, parseDateOnly, toLocalParts, todayLocal } from "@/lib/dates";
import { db } from "@/server/db";

const DAY = 86_400_000;

/** Data of the « Aujourd'hui » page (lot 1 version, §8.3). */
export async function getTodayOverview(brandId: string, timezone: string, now = new Date()) {
  const today = todayLocal(timezone, now);
  const dayAfterTomorrow = formatDateOnly(new Date(parseDateOnly(today).getTime() + 2 * DAY));
  const inAWeek = formatDateOnly(new Date(parseDateOnly(today).getTime() + 7 * DAY));
  const start = localToUtc(today, "00:00", timezone);
  const end = localToUtc(dayAfterTomorrow, "00:00", timezone);
  const weekEnd = localToUtc(inAWeek, "00:00", timezone);

  const livePosts = {
    deletedAt: null,
    status: { notIn: ["CANCELLED" as const] },
    campaign: { brandId, archivedAt: null },
  };

  const [upcoming, withoutText, campaigns] = await Promise.all([
    db.post.findMany({
      where: { ...livePosts, scheduledAt: { gte: start, lt: end } },
      select: {
        id: true,
        campaignId: true,
        status: true,
        format: true,
        scheduledAt: true,
        body: true,
        youtubeTitle: true,
        angle: true,
        content: { select: { code: true, title: true } },
        socialAccount: { select: { name: true, platform: true } },
        authorContributor: { select: { firstName: true, lastName: true } },
        campaign: { select: { name: true } },
      },
      orderBy: { scheduledAt: "asc" },
    }),
    db.post.findMany({
      where: {
        ...livePosts,
        status: { in: ["DRAFT", "IN_REVIEW"] },
        scheduledAt: { gte: now, lt: weekEnd },
        AND: [
          { OR: [{ body: null }, { body: "" }] },
          { OR: [{ youtubeTitle: null }, { youtubeTitle: "" }] },
        ],
      },
      select: { id: true, campaignId: true, scheduledAt: true },
      orderBy: { scheduledAt: "asc" },
    }),
    db.campaign.findMany({
      where: { brandId, archivedAt: null, status: { in: ["ACTIVE", "DRAFT"] } },
      select: {
        id: true,
        name: true,
        status: true,
        wizardStep: true,
        posts: {
          where: { deletedAt: null },
          select: {
            status: true,
            scheduledAt: true,
            socialAccount: { select: { platform: true } },
            authorContributorId: true,
          },
        },
      },
      orderBy: [{ status: "asc" }, { updatedAt: "desc" }],
      take: 6,
    }),
  ]);

  return {
    today,
    hour: Number(toLocalParts(now, timezone).time.slice(0, 2)),
    upcoming,
    withoutText,
    campaigns: campaigns.map(({ posts, ...c }) => ({
      ...c,
      stats: campaignStats(
        posts.map((p) => ({
          status: p.status,
          scheduledAt: p.scheduledAt,
          platform: p.socialAccount?.platform ?? (p.authorContributorId ? "LINKEDIN" : null),
        })),
        now,
      ),
    })),
  };
}
