import "server-only";
import type { z } from "zod";
import { campaignStats, daysBetween, WIZARD_DONE } from "@/lib/campaigns";
import { formatDateOnly, parseDateOnly, shiftLocalDays } from "@/lib/dates";
import type { campaignDraftSchema } from "@/lib/validations/campaign";
import { db } from "@/server/db";
import { AppError } from "@/server/errors";

type Actor = { id: string };

export type CampaignFilter = "all" | "DRAFT" | "ACTIVE" | "COMPLETED" | "ARCHIVED";

/** Campaigns of a brand with their statistics (list, palette, « Aujourd'hui »). */
export async function listCampaigns(brandId: string, filter: CampaignFilter = "all") {
  const campaigns = await db.campaign.findMany({
    where: {
      brandId,
      ...(filter === "ARCHIVED"
        ? { archivedAt: { not: null } }
        : { archivedAt: null, ...(filter === "all" ? {} : { status: filter }) }),
    },
    select: {
      id: true,
      name: true,
      status: true,
      startDate: true,
      endDate: true,
      wizardStep: true,
      archivedAt: true,
      updatedAt: true,
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
    orderBy: [{ updatedAt: "desc" }],
  });

  const now = new Date();
  return campaigns.map(({ posts, ...campaign }) => ({
    ...campaign,
    stats: campaignStats(
      posts.map((p) => ({
        status: p.status,
        scheduledAt: p.scheduledAt,
        // A contributor posts from their LinkedIn profile.
        platform: p.socialAccount?.platform ?? (p.authorContributorId ? "LINKEDIN" : null),
      })),
      now,
    ),
  }));
}

export type CampaignListItem = Awaited<ReturnType<typeof listCampaigns>>[number];

export async function countCampaignsByFilter(brandId: string) {
  const rows = await db.campaign.groupBy({
    by: ["status"],
    where: { brandId, archivedAt: null },
    _count: { _all: true },
  });
  const archived = await db.campaign.count({ where: { brandId, archivedAt: { not: null } } });
  const byStatus = Object.fromEntries(rows.map((r) => [r.status, r._count._all])) as Record<
    string,
    number
  >;
  return {
    all: rows.reduce((sum, r) => sum + r._count._all, 0),
    DRAFT: byStatus.DRAFT ?? 0,
    ACTIVE: byStatus.ACTIVE ?? 0,
    COMPLETED: byStatus.COMPLETED ?? 0,
    ARCHIVED: archived,
  };
}

export async function createCampaign(
  input: { brandId: string; name: string; objective?: string | null; startDate?: string | null },
  actor: Actor,
) {
  return db.$transaction(async (tx) => {
    const campaign = await tx.campaign.create({
      data: {
        brandId: input.brandId,
        name: input.name,
        objective: input.objective ?? null,
        startDate: input.startDate ? parseDateOnly(input.startDate) : null,
        createdById: actor.id,
        wizardStep: 1,
      },
    });
    await tx.activity.create({
      data: {
        brandId: input.brandId,
        campaignId: campaign.id,
        actorId: actor.id,
        type: "campaign.created",
        meta: { name: campaign.name },
      },
    });
    return campaign;
  });
}

/** Wizard autosave: only the fields present in the patch are written. */
export async function updateCampaignDraft(input: z.output<typeof campaignDraftSchema>) {
  const { campaignId, startDate, endDate, ...rest } = input;
  const data: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(rest)) if (value !== undefined) data[key] = value;
  if (startDate !== undefined) data.startDate = startDate ? parseDateOnly(startDate) : null;
  if (endDate !== undefined) data.endDate = endDate ? parseDateOnly(endDate) : null;

  if (input.mainContentId) {
    const content = await db.content.findFirst({
      where: { id: input.mainContentId, campaignId, deletedAt: null },
      select: { id: true },
    });
    if (!content) throw new AppError("INVALID", "Ce contenu n'appartient pas à la campagne.");
  }
  return db.campaign.update({
    where: { id: campaignId },
    data,
    select: { id: true, updatedAt: true },
  });
}

export async function renameCampaign(campaignId: string, name: string, actor: Actor) {
  const before = await db.campaign.findUniqueOrThrow({
    where: { id: campaignId },
    select: { name: true, brandId: true },
  });
  if (before.name === name) return;
  await db.$transaction([
    db.campaign.update({ where: { id: campaignId }, data: { name } }),
    db.activity.create({
      data: {
        brandId: before.brandId,
        campaignId,
        actorId: actor.id,
        type: "campaign.renamed",
        meta: { from: before.name, to: name },
      },
    }),
  ]);
}

export async function setCampaignArchived(campaignId: string, archived: boolean, actor: Actor) {
  const campaign = await db.campaign.update({
    where: { id: campaignId },
    data: { archivedAt: archived ? new Date() : null },
    select: { brandId: true },
  });
  await db.activity.create({
    data: {
      brandId: campaign.brandId,
      campaignId,
      actorId: actor.id,
      type: archived ? "campaign.archived" : "campaign.unarchived",
    },
  });
}

/** Permanent deletion, only for drafts that never published anything (confirmed in the UI). */
export async function deleteDraftCampaign(campaignId: string) {
  const campaign = await db.campaign.findUniqueOrThrow({
    where: { id: campaignId },
    select: {
      status: true,
      _count: { select: { posts: { where: { status: "PUBLISHED" } } } },
    },
  });
  if (campaign.status !== "DRAFT" || campaign._count.posts > 0) {
    throw new AppError(
      "CONFLICT",
      "Seule une campagne en brouillon, sans publication, peut être supprimée. Archivez-la plutôt.",
    );
  }
  await db.campaign.delete({ where: { id: campaignId } });
}

/**
 * Copies a campaign with its contents and posts (all back to draft, missions not copied).
 * With a new start date, every post moves by the same number of days, keeping its local time.
 */
export async function duplicateCampaign(
  campaignId: string,
  newStartDate: string | null | undefined,
  actor: Actor,
) {
  const source = await db.campaign.findUniqueOrThrow({
    where: { id: campaignId },
    include: {
      brand: { select: { timezone: true } },
      contents: { where: { deletedAt: null } },
      posts: { where: { deletedAt: null } },
    },
  });

  const shiftDays =
    newStartDate && source.startDate
      ? daysBetween(source.startDate, parseDateOnly(newStartDate))
      : 0;
  const tz = source.brand.timezone;
  const shiftDate = (d: Date | null) =>
    d ? parseDateOnly(formatDateOnly(new Date(d.getTime() + shiftDays * 86_400_000))) : null;

  return db.$transaction(async (tx) => {
    const copy = await tx.campaign.create({
      data: {
        brandId: source.brandId,
        name: `${source.name} (copie)`,
        status: "DRAFT",
        objective: source.objective,
        audience: source.audience,
        brief: source.brief,
        startDate: newStartDate ? parseDateOnly(newStartDate) : source.startDate,
        endDate: shiftDate(source.endDate),
        wizardStep: WIZARD_DONE,
        createdById: actor.id,
      },
    });

    // Contents first (parents before children), keeping a map old id → new id.
    const idMap = new Map<string, string>();
    const ordered = [...source.contents].sort(
      (a, b) => Number(!!a.parentId) - Number(!!b.parentId),
    );
    for (const c of ordered) {
      const created = await tx.content.create({
        data: {
          campaignId: copy.id,
          code: c.code,
          type: c.type,
          title: c.title,
          mediaUrl: c.mediaUrl,
          durationSec: c.durationSec,
          summary: c.summary,
          parentId: c.parentId ? (idMap.get(c.parentId) ?? null) : null,
        },
      });
      idMap.set(c.id, created.id);
    }
    if (source.mainContentId && idMap.has(source.mainContentId)) {
      await tx.campaign.update({
        where: { id: copy.id },
        data: { mainContentId: idMap.get(source.mainContentId) },
      });
    }

    if (source.posts.length > 0) {
      await tx.post.createMany({
        data: source.posts
          .filter((p) => p.status !== "CANCELLED")
          .map((p) => ({
            campaignId: copy.id,
            contentId: p.contentId ? (idMap.get(p.contentId) ?? null) : null,
            socialAccountId: p.socialAccountId,
            authorContributorId: p.authorContributorId,
            format: p.format,
            scheduledAt: shiftDays ? shiftLocalDays(p.scheduledAt, shiftDays, tz) : p.scheduledAt,
            angle: p.angle,
            body: p.body,
            bodySource: p.bodySource,
            youtubeTitle: p.youtubeTitle,
            youtubeDescription: p.youtubeDescription,
            youtubeTags: p.youtubeTags,
            linkToContentId: p.linkToContentId ? (idMap.get(p.linkToContentId) ?? null) : null,
            linkToUrl: p.linkToUrl,
            status: "DRAFT" as const,
          })),
      });
    }

    await tx.activity.create({
      data: {
        brandId: source.brandId,
        campaignId: copy.id,
        actorId: actor.id,
        type: "campaign.duplicated",
        meta: { from: source.name, shiftDays },
      },
    });
    return copy;
  });
}

/** Campaign fields + contents + counters for the wizard (steps 2 and 4). */
export async function getCampaignForWizard(campaignId: string, brandId: string) {
  const campaign = await db.campaign.findFirst({
    where: { id: campaignId, brandId },
    select: {
      id: true,
      name: true,
      status: true,
      objective: true,
      audience: true,
      keyMessage: true,
      callToAction: true,
      brief: true,
      startDate: true,
      endDate: true,
      mainContentId: true,
      wizardStep: true,
      archivedAt: true,
      contents: {
        where: { deletedAt: null },
        select: { id: true, code: true, title: true, type: true, mediaUrl: true },
        orderBy: { code: "asc" },
      },
      posts: {
        where: { deletedAt: null, status: { not: "CANCELLED" } },
        select: {
          body: true,
          socialAccount: { select: { platform: true } },
          authorContributorId: true,
        },
      },
    },
  });
  if (!campaign) return null;
  const { posts, ...rest } = campaign;
  const platformOf = (p: (typeof posts)[number]) =>
    p.socialAccount?.platform ?? (p.authorContributorId ? "LINKEDIN" : null);
  return {
    ...rest,
    summary: {
      posts: posts.length,
      linkedin: posts.filter((p) => platformOf(p) === "LINKEDIN").length,
      youtube: posts.filter((p) => platformOf(p) === "YOUTUBE").length,
      postsWithoutText: posts.filter((p) => !p.body?.trim()).length,
    },
  };
}

export type WizardCampaign = NonNullable<Awaited<ReturnType<typeof getCampaignForWizard>>>;

/** Header of the campaign page: fields, statistics and the brand's contributors count. */
export async function getCampaignOverview(campaignId: string, brandId: string) {
  const campaign = await db.campaign.findFirst({
    where: { id: campaignId, brandId },
    select: {
      id: true,
      name: true,
      status: true,
      objective: true,
      audience: true,
      keyMessage: true,
      callToAction: true,
      brief: true,
      startDate: true,
      endDate: true,
      mainContentId: true,
      wizardStep: true,
      archivedAt: true,
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
  });
  if (!campaign) return null;
  const { posts, ...rest } = campaign;
  return {
    ...rest,
    stats: campaignStats(
      posts.map((p) => ({
        status: p.status,
        scheduledAt: p.scheduledAt,
        platform: p.socialAccount?.platform ?? (p.authorContributorId ? "LINKEDIN" : null),
      })),
    ),
  };
}

export type CampaignOverview = NonNullable<Awaited<ReturnType<typeof getCampaignOverview>>>;

export async function listCampaignActivity(campaignId: string, take = 100) {
  const activities = await db.activity.findMany({
    where: { campaignId },
    orderBy: { createdAt: "desc" },
    take,
    select: { id: true, type: true, meta: true, actorId: true, actorLabel: true, createdAt: true },
  });
  // Explicit query rather than a relation (lesson from Essential).
  const actorIds = [...new Set(activities.map((a) => a.actorId).filter((id) => id !== null))];
  const users = await db.user.findMany({
    where: { id: { in: actorIds } },
    select: { id: true, name: true, email: true },
  });
  const nameOf = new Map(users.map((u) => [u.id, u.name?.split(" ")[0] || u.email]));
  return activities.map((a) => ({
    id: a.id,
    type: a.type,
    meta: (a.meta ?? {}) as Record<string, unknown>,
    actor: a.actorLabel ?? (a.actorId ? (nameOf.get(a.actorId) ?? "Quelqu'un") : "Campaign"),
    createdAt: a.createdAt,
  }));
}
