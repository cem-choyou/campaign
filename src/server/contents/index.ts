import "server-only";
import type { z } from "zod";
import type { contentSchema } from "@/lib/validations/content";
import { db } from "@/server/db";
import { AppError } from "@/server/errors";

type Actor = { id: string };

export async function listContents(campaignId: string) {
  return db.content.findMany({
    where: { campaignId, deletedAt: null },
    select: {
      id: true,
      code: true,
      type: true,
      title: true,
      mediaUrl: true,
      durationSec: true,
      summary: true,
      youtubeVideoId: true,
      parentId: true,
      _count: { select: { posts: { where: { deletedAt: null } } } },
    },
    orderBy: [{ type: "asc" }, { code: "asc" }],
  });
}

export type ContentItem = Awaited<ReturnType<typeof listContents>>[number];

/** Creates or updates a content. The code is unique within the campaign (soft-deleted ones free it). */
export async function saveContent(input: z.output<typeof contentSchema>, actor: Actor) {
  const campaign = await db.campaign.findUniqueOrThrow({
    where: { id: input.campaignId },
    select: { brandId: true },
  });

  const clash = await db.content.findFirst({
    where: {
      campaignId: input.campaignId,
      code: input.code,
      ...(input.contentId ? { NOT: { id: input.contentId } } : {}),
    },
    select: { id: true, deletedAt: true },
  });
  if (clash && !clash.deletedAt) {
    throw new AppError("CONFLICT", `Le code ${input.code} est déjà utilisé dans cette campagne.`);
  }
  if (input.parentId) {
    const parent = await db.content.findFirst({
      where: { id: input.parentId, campaignId: input.campaignId, deletedAt: null },
      select: { id: true },
    });
    if (!parent || parent.id === input.contentId) {
      throw new AppError("INVALID", "Choisissez une vidéo de la campagne.");
    }
  }

  const data = {
    code: input.code,
    type: input.type,
    title: input.title,
    mediaUrl: input.mediaUrl,
    durationSec: input.durationSec,
    summary: input.summary,
    youtubeVideoId: input.youtubeVideoId,
    parentId: input.parentId,
  };

  return db.$transaction(async (tx) => {
    // A soft-deleted content still holds the code: free it for the new one.
    if (clash?.deletedAt) {
      await tx.content.update({
        where: { id: clash.id },
        data: { code: `${input.code}~${clash.id.slice(-6)}` },
      });
    }
    if (input.contentId) {
      const { count } = await tx.content.updateMany({
        where: { id: input.contentId, campaignId: input.campaignId, deletedAt: null },
        data,
      });
      if (count === 0) throw new AppError("NOT_FOUND");
      return { id: input.contentId };
    }
    const created = await tx.content.create({
      data: { ...data, campaignId: input.campaignId },
      select: { id: true },
    });
    await tx.activity.create({
      data: {
        brandId: campaign.brandId,
        campaignId: input.campaignId,
        actorId: actor.id,
        type: "content.created",
        meta: { code: input.code },
      },
    });
    return created;
  });
}

/** Soft delete (with undo). Posts keep their data; their link to the content is kept until purge. */
export async function setContentDeleted(contentId: string, deleted: boolean) {
  const content = await db.content.update({
    where: { id: contentId },
    data: { deletedAt: deleted ? new Date() : null },
    select: { campaignId: true },
  });
  return content;
}

export async function getContentCampaignId(contentId: string) {
  const content = await db.content.findUnique({
    where: { id: contentId },
    select: { campaignId: true },
  });
  if (!content) throw new AppError("NOT_FOUND");
  return content.campaignId;
}
