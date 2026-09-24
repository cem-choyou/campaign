import { FileSpreadsheet } from "lucide-react";
import { cookies } from "next/headers";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Button } from "@/components/ui/button";
import { campaignsCopy } from "@/lib/copy/campaigns";
import type { CalendarView } from "@/components/calendar/post-calendar";
import { PlanningView } from "@/components/calendar/planning-view";
import { PostEditor } from "@/components/post-editor/post-editor";
import { formatDateOnly, todayLocal } from "@/lib/dates";
import { CALENDAR_VIEW_COOKIE, PLANNING_MODE_COOKIE } from "@/lib/preferences/cookies";
import { db } from "@/server/db";
import { getPostForEditor, getPostOptions, listCampaignPosts } from "@/server/posts";
import { requireBrandPage } from "@/server/permissions";

const VIEWS: CalendarView[] = ["dayGridMonth", "timeGridWeek", "listMonth"];

export default async function PlanningPage({
  params,
  searchParams,
}: {
  params: Promise<{ brandSlug: string; campaignId: string }>;
  searchParams: Promise<{ post?: string }>;
}) {
  const [{ brandSlug, campaignId }, { post: postId }] = await Promise.all([params, searchParams]);
  const access = await requireBrandPage(brandSlug);
  const campaign = await db.campaign.findFirst({
    where: { id: campaignId, brandId: access.brand.id },
    select: { id: true, startDate: true, archivedAt: true },
  });
  if (!campaign) notFound();

  const [posts, options, cookieStore, editorPost] = await Promise.all([
    listCampaignPosts(campaign.id),
    getPostOptions(campaign.id, access.brand.id),
    cookies(),
    postId ? getPostForEditor(postId, access.brand.id) : Promise.resolve(null),
  ]);
  const canEdit = access.can("campaign.edit") && !campaign.archivedAt;
  const view = cookieStore.get(CALENDAR_VIEW_COOKIE)?.value as CalendarView | undefined;
  const tz = access.brand.timezone;
  const today = todayLocal(tz);
  // Open on the campaign's first week when it is still to come, else on today.
  const start = campaign.startDate ? formatDateOnly(campaign.startDate) : null;

  return (
    <PlanningView
      posts={posts}
      options={options}
      timezone={tz}
      campaignId={campaign.id}
      canEdit={canEdit}
      initialMode={cookieStore.get(PLANNING_MODE_COOKIE)?.value === "list" ? "list" : "calendar"}
      initialView={view && VIEWS.includes(view) ? view : "dayGridMonth"}
      initialDate={start && start > today ? start : today}
      toolbar={
        canEdit && (
          <Button asChild variant="outline" size="sm">
            <Link href={`/${brandSlug}/campagnes/importer?campagne=${campaign.id}`}>
              <FileSpreadsheet aria-hidden />
              {campaignsCopy.importExcel}
            </Link>
          </Button>
        )
      }
    >
      <PostEditor
        post={editorPost && editorPost.campaignId === campaign.id ? editorPost : null}
        options={options}
        orderedIds={posts.filter((p) => p.status !== "CANCELLED").map((p) => p.id)}
        timezone={tz}
        canEdit={canEdit}
        brand={access.brand}
      />
    </PlanningView>
  );
}
