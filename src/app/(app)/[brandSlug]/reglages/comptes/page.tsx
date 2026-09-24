import { AccountsManager } from "@/components/settings/accounts-manager";
import { listContributors, listSocialAccounts } from "@/server/brands";
import { requireBrandPage } from "@/server/permissions";

export default async function AccountsPage({ params }: { params: Promise<{ brandSlug: string }> }) {
  const { brandSlug } = await params;
  const { brand } = await requireBrandPage(brandSlug, "brand.manage");
  const [accounts, contributors] = await Promise.all([
    listSocialAccounts(brand.id),
    listContributors(brand.id),
  ]);
  return (
    <AccountsManager
      brandId={brand.id}
      accounts={accounts}
      contributors={contributors.filter((c) => c.isActive)}
    />
  );
}
