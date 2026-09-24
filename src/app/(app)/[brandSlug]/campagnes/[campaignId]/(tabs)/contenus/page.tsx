import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ContentsManager } from "@/components/campaigns/contents-manager";
import { campaignCopy } from "@/lib/copy/campaign";
import { db } from "@/server/db";
import { listContents } from "@/server/contents";
import { requireBrandPage } from "@/server/permissions";

export const metadata: Metadata = { title: campaignCopy.contents.title };

export default async function ContentsPage({
  params,
}: {
  params: Promise<{ brandSlug: string; campaignId: string }>;
}) {
  const { brandSlug, campaignId } = await params;
  const access = await requireBrandPage(brandSlug);
  const campaign = await db.campaign.findFirst({
    where: { id: campaignId, brandId: access.brand.id },
    select: { id: true, mainContentId: true },
  });
  if (!campaign) notFound();
  const contents = await listContents(campaign.id);
  return (
    <ContentsManager
      campaignId={campaign.id}
      mainContentId={campaign.mainContentId}
      contents={contents}
      canEdit={access.can("campaign.edit")}
    />
  );
}
