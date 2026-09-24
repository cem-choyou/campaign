"use client";

import { Archive, CalendarDays, Plus } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";
import {
  renameCampaignAction,
  setCampaignArchivedAction,
} from "@/app/(app)/[brandSlug]/campagnes/actions";
import { PlatformIcon } from "@/components/brand/platform-icon";
import { InlineEdit } from "@/components/forms/inline-edit";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { campaignCopy } from "@/lib/copy/campaign";
import { campaignsCopy } from "@/lib/copy/campaigns";
import { platformLabels } from "@/lib/copy/common";
import { formatDateOnlyShort, formatDayTime } from "@/lib/dates";
import { CampaignStatusBadge } from "./status-badge";

export type CampaignHeaderData = {
  id: string;
  name: string;
  status: "DRAFT" | "ACTIVE" | "COMPLETED" | "ARCHIVED";
  startDate: Date | null;
  endDate: Date | null;
  archivedAt: Date | null;
  stats: {
    total: number;
    published: number;
    progress: number;
    platforms: ("LINKEDIN" | "YOUTUBE")[];
    nextPostAt: Date | null;
  };
};

export function CampaignHeader({
  campaign,
  brandSlug,
  timezone,
  canEdit,
  backLabel,
}: {
  campaign: CampaignHeaderData;
  brandSlug: string;
  timezone: string;
  canEdit: boolean;
  backLabel: string;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const base = `/${brandSlug}/campagnes/${campaign.id}`;

  const unarchive = () =>
    startTransition(async () => {
      const result = await setCampaignArchivedAction({ campaignId: campaign.id, archived: false });
      if (!result.ok) return void toast.error(result.error);
      toast.success(campaignsCopy.unarchived(campaign.name));
      router.refresh();
    });

  return (
    <div className="flex flex-col gap-3 px-4 pt-6 pb-4 sm:px-8 sm:pt-8">
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link href={`/${brandSlug}/campagnes`}>{backLabel}</Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage className="max-w-60 truncate">{campaign.name}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      {campaign.archivedAt && (
        <div className="bg-muted flex flex-wrap items-center gap-3 rounded-lg px-4 py-3 text-sm">
          <Archive className="text-muted-foreground size-4" aria-hidden />
          <p className="flex-1">{campaignCopy.archivedBanner}</p>
          {canEdit && (
            <Button size="sm" variant="outline" onClick={unarchive}>
              {campaignCopy.unarchive}
            </Button>
          )}
        </div>
      )}

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="w-full min-w-0 sm:w-auto sm:flex-1">
          <h1 className="text-xl font-semibold tracking-tight">
            <InlineEdit
              value={campaign.name}
              label={campaignsCopy.inlineRename.label}
              hint={campaignsCopy.inlineRename.hint}
              disabled={!canEdit}
              onSave={async (name) => {
                const result = await renameCampaignAction({ campaignId: campaign.id, name });
                if (!result.ok) {
                  toast.error(result.error);
                  return false;
                }
                router.refresh();
                return true;
              }}
            />
          </h1>
          <div className="text-muted-foreground mt-2 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
            <CampaignStatusBadge status={campaign.status} archived={!!campaign.archivedAt} />
            <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
              <CalendarDays className="size-4" aria-hidden />
              {campaign.startDate
                ? campaignsCopy.datesRange(
                    formatDateOnlyShort(campaign.startDate),
                    campaign.endDate ? formatDateOnlyShort(campaign.endDate) : undefined,
                  )
                : campaignsCopy.noDates}
            </span>
            {campaign.stats.platforms.length > 0 && (
              <span className="inline-flex items-center gap-1.5">
                {campaign.stats.platforms.map((p) => (
                  <span key={p} title={platformLabels[p]}>
                    <PlatformIcon platform={p} className="size-3.5" />
                    <span className="sr-only">{platformLabels[p]}</span>
                  </span>
                ))}
              </span>
            )}
            <span className="inline-flex items-center gap-2">
              <Progress
                value={campaign.stats.progress * 100}
                className="h-1.5 w-24"
                aria-label={campaignsCopy.progress(campaign.stats.published, campaign.stats.total)}
              />
              <span className="tabular text-xs">
                {campaignCopy.published(campaign.stats.published, campaign.stats.total)}
              </span>
            </span>
            {campaign.stats.nextPostAt && (
              <span className="tabular text-xs">
                {campaignsCopy.next(formatDayTime(campaign.stats.nextPostAt, timezone))}
              </span>
            )}
          </div>
        </div>
        {canEdit && !campaign.archivedAt && (
          <Button asChild>
            <Link href={`${base}?nouveau=1`} scroll={false}>
              <Plus aria-hidden />
              {campaignCopy.addPost}
            </Link>
          </Button>
        )}
      </div>
    </div>
  );
}
