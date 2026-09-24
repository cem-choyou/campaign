import { AccessManager } from "@/components/settings/access-manager";
import { listAccess } from "@/server/brands";
import { requireBrandPage } from "@/server/permissions";

export default async function AccessPage({ params }: { params: Promise<{ brandSlug: string }> }) {
  const { brandSlug } = await params;
  const { brand, user } = await requireBrandPage(brandSlug, "access.manage");
  const { members, invitations } = await listAccess(brand.id);
  return (
    <AccessManager
      brandId={brand.id}
      currentUserId={user.id}
      members={members}
      invitations={invitations}
      timezone={brand.timezone}
    />
  );
}
