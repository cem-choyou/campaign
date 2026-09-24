import { BrandGeneralForm } from "@/components/settings/brand-general-form";
import { requireBrandPage } from "@/server/permissions";

export default async function BrandSettingsPage({
  params,
}: {
  params: Promise<{ brandSlug: string }>;
}) {
  const { brandSlug } = await params;
  const { brand } = await requireBrandPage(brandSlug, "brand.manage");
  return <BrandGeneralForm key={brand.id} brand={brand} />;
}
