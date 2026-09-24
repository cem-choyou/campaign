import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/page-header";
import { TabLinks } from "@/components/layout/tab-links";
import { settingsCopy } from "@/lib/copy/settings";
import { requireBrandPage } from "@/server/permissions";

export const metadata: Metadata = { title: settingsCopy.title };

export default async function SettingsLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ brandSlug: string }>;
}) {
  const { brandSlug } = await params;
  await requireBrandPage(brandSlug, "brand.manage");
  const base = `/${brandSlug}/reglages`;

  return (
    <>
      <PageHeader title={settingsCopy.title} description={settingsCopy.description} />
      <TabLinks
        label={settingsCopy.title}
        className="mx-4 sm:mx-8"
        items={[
          { href: `${base}/marque`, label: settingsCopy.tabs.brand },
          { href: `${base}/comptes`, label: settingsCopy.tabs.accounts },
          { href: `${base}/acces`, label: settingsCopy.tabs.access },
          { href: `${base}/relais`, label: settingsCopy.tabs.contributors },
        ]}
      />
      <div className="px-4 pt-6 pb-12 sm:px-8">{children}</div>
    </>
  );
}
