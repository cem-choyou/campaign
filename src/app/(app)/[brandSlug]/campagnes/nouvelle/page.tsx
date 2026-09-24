import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/page-header";
import { CampaignWizard } from "@/components/wizard/campaign-wizard";
import { suggestedCampaignName } from "@/lib/campaigns";
import { campaignsCopy } from "@/lib/copy/campaigns";
import { wizardCopy } from "@/lib/copy/wizard";
import { requireBrandPage } from "@/server/permissions";

export const metadata: Metadata = { title: wizardCopy.pageTitle };

export default async function NewCampaignPage({
  params,
}: {
  params: Promise<{ brandSlug: string }>;
}) {
  const { brandSlug } = await params;
  const { brand } = await requireBrandPage(brandSlug, "campaign.edit");

  return (
    <>
      <PageHeader
        className="mx-auto w-full max-w-2xl"
        title={wizardCopy.pageTitle}
        breadcrumbs={[
          { label: campaignsCopy.title, href: `/${brandSlug}/campagnes` },
          { label: wizardCopy.breadcrumb },
        ]}
      />
      <CampaignWizard
        brand={brand}
        campaignId={null}
        contents={[]}
        summary={{ posts: 0, linkedin: 0, youtube: 0, postsWithoutText: 0 }}
        initialValues={{
          name: suggestedCampaignName(new Date(), brand.timezone),
          startDate: "",
          endDate: "",
          objective: "",
          audience: "",
          keyMessage: "",
          callToAction: "",
          brief: "",
          mainContentId: "",
          wizardStep: 1,
        }}
      />
    </>
  );
}
