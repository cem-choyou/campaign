import { History } from "lucide-react";
import type { Metadata } from "next";
import { EmptyState } from "@/components/empty-states/empty-state";
import { activitySentence } from "@/lib/activity";
import { campaignCopy } from "@/lib/copy/campaign";
import { formatDayTime, formatRelative } from "@/lib/dates";
import { db } from "@/server/db";
import { listCampaignActivity } from "@/server/campaigns";
import { requireBrandPage } from "@/server/permissions";

export const metadata: Metadata = { title: campaignCopy.activity.title };

export default async function ActivityPage({
  params,
}: {
  params: Promise<{ brandSlug: string; campaignId: string }>;
}) {
  const { brandSlug, campaignId } = await params;
  const access = await requireBrandPage(brandSlug);
  const exists = await db.campaign.count({ where: { id: campaignId, brandId: access.brand.id } });
  const items = exists ? await listCampaignActivity(campaignId) : [];
  const tz = access.brand.timezone;
  const now = new Date();

  return (
    <section className="max-w-2xl">
      <h2 className="text-base font-semibold">{campaignCopy.activity.title}</h2>
      <p className="text-muted-foreground mt-1">{campaignCopy.activity.description}</p>
      {items.length === 0 ? (
        <EmptyState icon={History} title={campaignCopy.activity.empty} className="mt-4" />
      ) : (
        <ol className="mt-5 border-l pl-5">
          {items.map((item) => (
            <li key={item.id} className="relative pb-5 last:pb-0">
              <span
                className="bg-border ring-background absolute top-1.5 -left-[25px] size-2.5 rounded-full ring-4"
                aria-hidden
              />
              <p>{activitySentence(item.type, item.meta, item.actor)}</p>
              <time
                dateTime={item.createdAt.toISOString()}
                title={formatDayTime(item.createdAt, tz)}
                className="text-muted-foreground text-xs"
              >
                {formatRelative(item.createdAt, now, tz)}
              </time>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
