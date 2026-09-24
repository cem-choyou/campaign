"use server";

import { z } from "zod";
import { id } from "@/lib/validations/common";
import {
  postBulkSchema,
  postCreateSchema,
  postMoveSchema,
  postRestoreSchema,
  postSetTimeSchema,
  postShiftSchema,
  postUpdateSchema,
} from "@/lib/validations/post";
import { db } from "@/server/db";
import { AppError, runAction } from "@/server/errors";
import { requireBrandPermission, requireCampaignPermission } from "@/server/permissions";
import {
  brandOfPosts,
  createPost,
  deletePosts,
  getPostForEditor,
  movePost,
  restorePostDates,
  restorePosts,
  setPostsTime,
  shiftPosts,
  updatePost,
} from "@/server/posts";
import { applyTransition } from "@/server/posts/transitions";

// Posts are edited from the campaign planning, the brand calendar and the editor panel.
// No revalidatePath: the planning updates optimistically and refreshes itself.

async function requirePostPermission(postId: string) {
  const post = await db.post.findUnique({
    where: { id: postId },
    select: { campaignId: true },
  });
  if (!post) throw new AppError("NOT_FOUND");
  return requireCampaignPermission(post.campaignId, "campaign.edit");
}

async function requirePostsPermission(postIds: string[]) {
  const brandId = await brandOfPosts(postIds);
  return requireBrandPermission({ brandId }, "campaign.edit");
}

export async function createPostAction(input: z.input<typeof postCreateSchema>) {
  return runAction(postCreateSchema, input, async (data) => {
    const access = await requireCampaignPermission(data.campaignId, "campaign.edit");
    return createPost(data, access.user);
  });
}

export async function updatePostAction(input: z.input<typeof postUpdateSchema>) {
  return runAction(postUpdateSchema, input, async (data) => {
    const access = await requirePostPermission(data.postId);
    const post = await updatePost(data, access.user);
    return {
      status: post.status,
      scheduledAt: post.scheduledAt.toISOString(),
      updatedAt: post.updatedAt.toISOString(),
    };
  });
}

export async function movePostAction(input: z.input<typeof postMoveSchema>) {
  return runAction(postMoveSchema, input, async (data) => {
    const access = await requirePostPermission(data.postId);
    return movePost(data, access.user);
  });
}

export async function shiftPostsAction(input: z.input<typeof postShiftSchema>) {
  return runAction(postShiftSchema, input, async (data) => {
    const access = await requirePostsPermission(data.postIds);
    return shiftPosts(data.postIds, data.days, access.user);
  });
}

export async function setPostsTimeAction(input: z.input<typeof postSetTimeSchema>) {
  return runAction(postSetTimeSchema, input, async (data) => {
    const access = await requirePostsPermission(data.postIds);
    return setPostsTime(data.postIds, data.time, access.user);
  });
}

const restoreDatesSchema = z.object({
  items: z
    .array(z.object({ id, scheduledAt: z.iso.datetime() }))
    .min(1)
    .max(500),
});

export async function restorePostDatesAction(input: z.input<typeof restoreDatesSchema>) {
  return runAction(restoreDatesSchema, input, async (data) => {
    await requirePostsPermission(data.items.map((i) => i.id));
    await restorePostDates(data.items);
  });
}

export async function deletePostsAction(input: z.input<typeof postBulkSchema>) {
  return runAction(postBulkSchema, input, async (data) => {
    const access = await requirePostsPermission(data.postIds);
    return deletePosts(data.postIds, access.user);
  });
}

export async function restorePostsAction(input: z.input<typeof postRestoreSchema>) {
  return runAction(postRestoreSchema, input, async (data) => {
    await requirePostsPermission(data.postIds);
    await restorePosts(data.postIds);
  });
}

const cancelSchema = z.object({ postId: id });

export async function cancelPostAction(input: z.input<typeof cancelSchema>) {
  return runAction(cancelSchema, input, async (data) => {
    const access = await requirePostPermission(data.postId);
    return applyTransition(data.postId, "cancel", { kind: "user", brandId: access.brand.id });
  });
}

const loadSchema = z.object({ postId: id });

/** Loads one post for the editor panel (J/K navigation). */
export async function loadPostAction(input: z.input<typeof loadSchema>) {
  return runAction(loadSchema, input, async (data) => {
    const post = await db.post.findUnique({
      where: { id: data.postId },
      select: { campaign: { select: { brandId: true } } },
    });
    if (!post) throw new AppError("NOT_FOUND");
    const access = await requireBrandPermission({ brandId: post.campaign.brandId }, "brand.view");
    const full = await getPostForEditor(data.postId, access.brand.id);
    if (!full) throw new AppError("NOT_FOUND");
    return full;
  });
}
