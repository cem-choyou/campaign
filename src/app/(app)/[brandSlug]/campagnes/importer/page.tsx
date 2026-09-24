import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ImportFlow } from "@/components/import/import-flow";
import { PageBody, PageHeader } from "@/components/layout/page-header";
import { campaignsCopy } from "@/lib/copy/campaigns";
import { importCopy } from "@/lib/copy/import";
import { db } from "@/server/db";
import { requireBrandPage } from "@/server/permissions";

export const metadata: Metadata = { title: importCopy.pageTitle };

export default async function ImportPage({
  params,
  searchParams,
}: {
  params: Promise<{ brandSlug: string }>;
  searchParams: Promise<{ campagne?: string }>;
}) {
  const [{ brandSlug }, { campagne }] = await Promise.all([params, searchParams]);
  const { brand } = await requireBrandPage(brandSlug, "campaign.edit");
  const campaign = campagne
    ? await db.campaign.findFirst({
        where: { id: campagne, brandId: brand.id, archivedAt: null },
        select: { id: true, name: true },
      })
    : null;
  if (campagne && !campaign) notFound();

  const base = `/${brandSlug}/campagnes`;
  return (
    <>
      <PageHeader
        title={importCopy.pageTitle}
        description={campaign ? importCopy.intoCampaign(campaign.name) : importCopy.pageDescription}
        breadcrumbs={[
          { label: campaignsCopy.title, href: base },
          ...(campaign ? [{ label: campaign.name, href: `${base}/${campaign.id}` }] : []),
          { label: importCopy.breadcrumb },
        ]}
      />
      <PageBody>
        <ImportFlow
          brand={{ id: brand.id, slug: brand.slug, timezone: brand.timezone }}
          campaign={campaign}
        />
      </PageBody>
    </>
  );
}
