import { cookies } from "next/headers";
import { AppShell } from "@/components/layout/app-shell";
import { brandAccentCss } from "@/lib/color";
import { SIDEBAR_COOKIE } from "@/lib/preferences/cookies";
import { db } from "@/server/db";
import { listAccessibleBrands, requireBrandPage } from "@/server/permissions";

export default async function BrandLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ brandSlug: string }>;
}) {
  const { brandSlug } = await params;
  const access = await requireBrandPage(brandSlug);
  const { user, brand } = access;

  // Remember the brand to resume here at the next visit (§8.2).
  if (user.lastBrandId !== brand.id) {
    await db.user.update({ where: { id: user.id }, data: { lastBrandId: brand.id } });
  }

  const [brands, cookieStore] = await Promise.all([listAccessibleBrands(user), cookies()]);

  return (
    <>
      {/* Brand accent for the whole document (portals included). Values are normalized hex. */}
      <style precedence="default" href={`brand-accent-${brand.id}`}>
        {brandAccentCss(brand.color)}
      </style>
      <AppShell
        user={{
          name: user.name,
          email: user.email,
          image: user.image,
          isSuperAdmin: user.isSuperAdmin,
        }}
        brand={brand}
        brands={brands}
        timezone={brand.timezone}
        permissions={{
          canManageBrand: access.can("brand.manage"),
          canEditCampaigns: access.can("campaign.edit"),
          canCreateBrand: access.can("brand.create"),
        }}
        initialCollapsed={cookieStore.get(SIDEBAR_COOKIE)?.value === "collapsed"}
      >
        {children}
      </AppShell>
    </>
  );
}
