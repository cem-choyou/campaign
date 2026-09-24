import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CampaignSettingsForm } from "@/components/campaigns/campaign-settings-form";
import { campaignCopy } from "@/lib/copy/campaign";
import { formatDateOnly } from "@/lib/dates";
import { getCampaignOverview } from "@/server/campaigns";
import { requireBrandPage } from "@/server/permissions";

export const metadata: Metadata = { title: campaignCopy.settings.title };

export default async function CampaignSettingsPage({
  params,
}: {
  params: Promise<{ brandSlug: string; campaignId: string }>;
}) {
  const { brandSlug, campaignId } = await params;
  const access = await requireBrandPage(brandSlug, "campaign.edit");
  const c = await getCampaignOverview(campaignId, access.brand.id);
  if (!c) notFound();
  return (
    <CampaignSettingsForm
      campaignId={c.id}
      brandSlug={brandSlug}
      archived={!!c.archivedAt}
      initialValues={{
        name: c.name,
        startDate: c.startDate ? formatDateOnly(c.startDate) : "",
        endDate: c.endDate ? formatDateOnly(c.endDate) : "",
        objective: c.objective ?? "",
        audience: c.audience ?? "",
        keyMessage: c.keyMessage ?? "",
        callToAction: c.callToAction ?? "",
        brief: c.brief ?? "",
      }}
    />
  );
}
