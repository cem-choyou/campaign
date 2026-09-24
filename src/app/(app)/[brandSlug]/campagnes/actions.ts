"use server";

import { revalidatePath } from "next/cache";
import type { z } from "zod";
import {
  campaignArchiveSchema,
  campaignCreateSchema,
  campaignDraftSchema,
  campaignDuplicateSchema,
  campaignIdSchema,
  campaignRenameSchema,
} from "@/lib/validations/campaign";
import { contentDeleteSchema, contentSchema } from "@/lib/validations/content";
import {
  createCampaign,
  deleteDraftCampaign,
  duplicateCampaign,
  renameCampaign,
  setCampaignArchived,
  updateCampaignDraft,
} from "@/server/campaigns";
import { getContentCampaignId, saveContent, setContentDeleted } from "@/server/contents";
import { runAction } from "@/server/errors";
import { requireBrandPermission, requireCampaignPermission } from "@/server/permissions";

// Pages are dynamic (never cached on the client), so most actions need no revalidation. Actions
// used inside the wizard must not revalidate: it would re-render the page mid-typing.
function refresh(slug: string) {
  revalidatePath(`/${slug}`, "layout");
}

export async function createCampaignAction(input: z.input<typeof campaignCreateSchema>) {
  return runAction(campaignCreateSchema, input, async (data) => {
    const access = await requireBrandPermission({ brandId: data.brandId }, "campaign.edit");
    const campaign = await createCampaign(data, access.user);
    return { id: campaign.id };
  });
}

export async function saveCampaignDraftAction(input: z.input<typeof campaignDraftSchema>) {
  return runAction(campaignDraftSchema, input, async (data) => {
    await requireCampaignPermission(data.campaignId, "campaign.edit");
    const saved = await updateCampaignDraft(data);
    return { updatedAt: saved.updatedAt.toISOString() };
  });
}

export async function renameCampaignAction(input: z.input<typeof campaignRenameSchema>) {
  return runAction(campaignRenameSchema, input, async (data) => {
    const access = await requireCampaignPermission(data.campaignId, "campaign.edit");
    await renameCampaign(data.campaignId, data.name, access.user);
    refresh(access.brand.slug);
  });
}

export async function duplicateCampaignAction(input: z.input<typeof campaignDuplicateSchema>) {
  return runAction(campaignDuplicateSchema, input, async (data) => {
    const access = await requireCampaignPermission(data.campaignId, "campaign.edit");
    const copy = await duplicateCampaign(data.campaignId, data.startDate, access.user);
    refresh(access.brand.slug);
    return { id: copy.id, name: copy.name };
  });
}

export async function setCampaignArchivedAction(input: z.input<typeof campaignArchiveSchema>) {
  return runAction(campaignArchiveSchema, input, async (data) => {
    const access = await requireCampaignPermission(data.campaignId, "campaign.edit");
    await setCampaignArchived(data.campaignId, data.archived, access.user);
    refresh(access.brand.slug);
  });
}

export async function deleteCampaignAction(input: z.input<typeof campaignIdSchema>) {
  return runAction(campaignIdSchema, input, async (data) => {
    const access = await requireCampaignPermission(data.campaignId, "campaign.edit");
    await deleteDraftCampaign(data.campaignId);
    refresh(access.brand.slug);
  });
}

// ---------- Contents ----------

export async function saveContentAction(input: z.input<typeof contentSchema>) {
  return runAction(contentSchema, input, async (data) => {
    const access = await requireCampaignPermission(data.campaignId, "campaign.edit");
    return saveContent(data, access.user);
  });
}

export async function setContentDeletedAction(input: z.input<typeof contentDeleteSchema>) {
  return runAction(contentDeleteSchema, input, async (data) => {
    const campaignId = await getContentCampaignId(data.contentId);
    const access = await requireCampaignPermission(campaignId, "campaign.edit");
    await setContentDeleted(data.contentId, !data.restore);
    refresh(access.brand.slug);
  });
}
