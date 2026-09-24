import { notFound } from "next/navigation";
import { CampaignHeader } from "@/components/campaigns/campaign-header";
import { TabLinks } from "@/components/layout/tab-links";
import { campaignCopy } from "@/lib/copy/campaign";
import { campaignsCopy } from "@/lib/copy/campaigns";
import { getCampaignOverview } from "@/server/campaigns";
import { requireBrandPage } from "@/server/permissions";

export default async function CampaignLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ brandSlug: string; campaignId: string }>;
}) {
  const { brandSlug, campaignId } = await params;
  const access = await requireBrandPage(brandSlug);
  const campaign = await getCampaignOverview(campaignId, access.brand.id);
  if (!campaign) notFound();
  const base = `/${brandSlug}/campagnes/${campaign.id}`;

  return (
    <>
      <CampaignHeader
        campaign={campaign}
        brandSlug={brandSlug}
        timezone={access.brand.timezone}
        canEdit={access.can("campaign.edit")}
        backLabel={campaignsCopy.title}
      />
      <TabLinks
        label={campaignCopy.tabsLabel}
        className="mx-4 sm:mx-8"
        items={[
          { href: base, label: campaignCopy.tabs.planning, exact: true },
          { href: `${base}/contenus`, label: campaignCopy.tabs.contents },
          { href: `${base}/activite`, label: campaignCopy.tabs.activity },
          ...(access.can("campaign.edit")
            ? [{ href: `${base}/reglages`, label: campaignCopy.tabs.settings }]
            : []),
        ]}
      />
      <div className="px-4 pt-6 pb-12 sm:px-8">{children}</div>
    </>
  );
}
