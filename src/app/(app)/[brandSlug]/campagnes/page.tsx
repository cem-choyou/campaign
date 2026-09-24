import { FileSpreadsheet, Plus } from "lucide-react";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import Link from "next/link";
import { type CampaignFilterKey, CampaignList } from "@/components/campaigns/campaign-list";
import { PageBody, PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { campaignsCopy } from "@/lib/copy/campaigns";
import { CAMPAIGNS_VIEW_COOKIE } from "@/lib/preferences/cookies";
import { countCampaignsByFilter, listCampaigns } from "@/server/campaigns";
import { requireBrandPage } from "@/server/permissions";

export const metadata: Metadata = { title: campaignsCopy.title };

const FILTERS: Record<string, CampaignFilterKey> = {
  draft: "DRAFT",
  active: "ACTIVE",
  completed: "COMPLETED",
  archived: "ARCHIVED",
};

export default async function CampaignsPage({
  params,
  searchParams,
}: {
  params: Promise<{ brandSlug: string }>;
  searchParams: Promise<{ statut?: string }>;
}) {
  const [{ brandSlug }, { statut }] = await Promise.all([params, searchParams]);
  const access = await requireBrandPage(brandSlug);
  const filter = (statut && FILTERS[statut]) || "all";
  const [campaigns, counts, cookieStore] = await Promise.all([
    listCampaigns(access.brand.id, filter),
    countCampaignsByFilter(access.brand.id),
    cookies(),
  ]);
  const canEdit = access.can("campaign.edit");

  return (
    <>
      <PageHeader
        title={campaignsCopy.title}
        description={campaignsCopy.description}
        actions={
          canEdit &&
          campaigns.length + counts.all > 0 && (
            <>
              <Button asChild variant="outline">
                <Link href={`/${brandSlug}/campagnes/importer`}>
                  <FileSpreadsheet aria-hidden />
                  {campaignsCopy.importExcel}
                </Link>
              </Button>
              <Button asChild>
                <Link href={`/${brandSlug}/campagnes/nouvelle`}>
                  <Plus aria-hidden />
                  {campaignsCopy.create}
                </Link>
              </Button>
            </>
          )
        }
      />
      <PageBody>
        <CampaignList
          brandSlug={brandSlug}
          campaigns={campaigns}
          counts={counts}
          filter={filter}
          initialView={
            cookieStore.get(CAMPAIGNS_VIEW_COOKIE)?.value === "table" ? "table" : "cards"
          }
          timezone={access.brand.timezone}
          canEdit={canEdit}
        />
      </PageBody>
    </>
  );
}
