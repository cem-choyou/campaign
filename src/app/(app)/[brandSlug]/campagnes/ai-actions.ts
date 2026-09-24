"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { id } from "@/lib/validations/common";
import {
  briefQuestions,
  listPostsToWrite,
  plannedPostSchema,
  proposePlanning,
  writeBrief,
} from "@/server/ai/campaign";
import { writeEmptyPost } from "@/server/ai/posts";
import { getCampaignForWizard } from "@/server/campaigns";
import { db } from "@/server/db";
import { AppError, runAction } from "@/server/errors";
import { createPostsFromPlan } from "@/server/import";
import { requireBrandPermission, requireCampaignPermission } from "@/server/permissions";

// Campaign-level AI (§8.5, §10.3). Every action checks `campaign.edit` on the server.

const campaignSchema = z.object({ campaignId: id });

/** Posts the bulk writer will draft (no text yet, not locked). */
export async function listPostsToWriteAction(input: z.input<typeof campaignSchema>) {
  return runAction(campaignSchema, input, async (data) => {
    await requireCampaignPermission(data.campaignId, "campaign.edit");
    return listPostsToWrite(data.campaignId);
  });
}

const postSchema = z.object({ postId: id });

/** One step of the bulk writer (the page runs 3 at a time). */
export async function writePostAction(input: z.input<typeof postSchema>) {
  return runAction(postSchema, input, async (data) => {
    const post = await db.post.findUnique({
      where: { id: data.postId },
      select: { campaignId: true },
    });
    if (!post) throw new AppError("NOT_FOUND");
    const access = await requireCampaignPermission(post.campaignId, "campaign.edit");
    return writeEmptyPost(data.postId, { userId: access.user.id, brandId: access.brand.id });
  });
}

const draftSchema = z.object({
  name: z.string().trim().max(120).default(""),
  objective: z.string().trim().max(2000).default(""),
  audience: z.string().trim().max(2000).default(""),
  keyMessage: z.string().trim().max(2000).default(""),
  callToAction: z.string().trim().max(300).default(""),
  brief: z.string().trim().max(5000).default(""),
});

const questionsSchema = z.object({ brandId: id, draft: draftSchema });

export async function briefQuestionsAction(input: z.input<typeof questionsSchema>) {
  return runAction(questionsSchema, input, async (data) => {
    const access = await requireBrandPermission({ brandId: data.brandId }, "campaign.edit");
    return briefQuestions(access.brand, data.draft, { userId: access.user.id });
  });
}

const briefSchema = questionsSchema.extend({
  answers: z
    .array(z.object({ question: z.string().max(300), answer: z.string().trim().max(1000) }))
    .max(3),
});

export async function writeBriefAction(input: z.input<typeof briefSchema>) {
  return runAction(briefSchema, input, async (data) => {
    const access = await requireBrandPermission({ brandId: data.brandId }, "campaign.edit");
    return writeBrief(access.brand, data.draft, data.answers, { userId: access.user.id });
  });
}

export async function proposePlanningAction(input: z.input<typeof campaignSchema>) {
  return runAction(campaignSchema, input, async (data) => {
    const access = await requireCampaignPermission(data.campaignId, "campaign.edit");
    return proposePlanning(data.campaignId, access.brand, { userId: access.user.id });
  });
}

/** Step 4 figures of the wizard, refreshed after the AI created or wrote posts. */
export async function campaignSummaryAction(input: z.input<typeof campaignSchema>) {
  return runAction(campaignSchema, input, async (data) => {
    const access = await requireCampaignPermission(data.campaignId, "campaign.edit");
    const campaign = await getCampaignForWizard(data.campaignId, access.brand.id);
    if (!campaign) throw new AppError("NOT_FOUND");
    return campaign.summary;
  });
}

const planSchema = campaignSchema.extend({ items: z.array(plannedPostSchema).min(1).max(60) });

/** The accepted proposal, created like an import into the campaign (same checks). */
export async function createPlanAction(input: z.input<typeof planSchema>) {
  return runAction(planSchema, input, async (data) => {
    const access = await requireCampaignPermission(data.campaignId, "campaign.edit");
    const result = await createPostsFromPlan({
      campaignId: data.campaignId,
      brandId: access.brand.id,
      items: data.items,
      actor: access.user,
    });
    revalidatePath(`/${access.brand.slug}`, "layout");
    return { created: result.created };
  });
}
