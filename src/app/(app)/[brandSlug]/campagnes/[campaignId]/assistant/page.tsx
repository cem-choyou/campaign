import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { CampaignWizard } from "@/components/wizard/campaign-wizard";
import { campaignsCopy } from "@/lib/copy/campaigns";
import { wizardCopy } from "@/lib/copy/wizard";
import { formatDateOnly } from "@/lib/dates";
import { getCampaignForWizard } from "@/server/campaigns";
import { requireBrandPage } from "@/server/permissions";

export const metadata: Metadata = { title: wizardCopy.pageTitle };

export default async function CampaignWizardPage({
  params,
}: {
  params: Promise<{ brandSlug: string; campaignId: string }>;
}) {
  const { brandSlug, campaignId } = await params;
  const { brand } = await requireBrandPage(brandSlug, "campaign.edit");
  const campaign = await getCampaignForWizard(campaignId, brand.id);
  if (!campaign || campaign.archivedAt) notFound();

  return (
    <>
      <PageHeader
        className="mx-auto w-full max-w-2xl"
        title={campaign.name}
        breadcrumbs={[
          { label: campaignsCopy.title, href: `/${brandSlug}/campagnes` },
          { label: campaign.name, href: `/${brandSlug}/campagnes/${campaign.id}` },
          { label: wizardCopy.resumeBreadcrumb },
        ]}
      />
      <CampaignWizard
        brand={brand}
        campaignId={campaign.id}
        contents={campaign.contents}
        summary={campaign.summary}
        initialValues={{
          name: campaign.name,
          startDate: campaign.startDate ? formatDateOnly(campaign.startDate) : "",
          endDate: campaign.endDate ? formatDateOnly(campaign.endDate) : "",
          objective: campaign.objective ?? "",
          audience: campaign.audience ?? "",
          keyMessage: campaign.keyMessage ?? "",
          callToAction: campaign.callToAction ?? "",
          brief: campaign.brief ?? "",
          mainContentId: campaign.mainContentId ?? "",
          // Resuming a finished wizard shows the summary.
          wizardStep: Math.min(campaign.wizardStep, 4),
        }}
      />
    </>
  );
}
