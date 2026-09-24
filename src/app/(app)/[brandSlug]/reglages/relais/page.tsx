import { ContributorsManager } from "@/components/settings/contributors-manager";
import { listContributors } from "@/server/brands";
import { requireBrandPage } from "@/server/permissions";

export default async function ContributorsPage({
  params,
}: {
  params: Promise<{ brandSlug: string }>;
}) {
  const { brandSlug } = await params;
  const { brand } = await requireBrandPage(brandSlug, "brand.manage");
  const contributors = await listContributors(brand.id);
  return <ContributorsManager brandId={brand.id} contributors={contributors} />;
}
