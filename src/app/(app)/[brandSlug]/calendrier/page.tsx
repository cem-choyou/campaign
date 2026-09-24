import type { Metadata } from "next";
import { cookies } from "next/headers";
import { PageBody, PageHeader } from "@/components/layout/page-header";
import { BrandPlanning } from "@/components/calendar/brand-planning";
import type { CalendarView } from "@/components/calendar/post-calendar";
import { planningCopy } from "@/lib/copy/planning";
import { todayLocal } from "@/lib/dates";
import { CALENDAR_VIEW_COOKIE, PLANNING_MODE_COOKIE } from "@/lib/preferences/cookies";
import { db } from "@/server/db";
import { listBrandPosts } from "@/server/posts";
import { requireBrandPage } from "@/server/permissions";

export const metadata: Metadata = { title: planningCopy.brandCalendar.title };

const VIEWS: CalendarView[] = ["dayGridMonth", "timeGridWeek", "listMonth"];

export default async function BrandCalendarPage({
  params,
}: {
  params: Promise<{ brandSlug: string }>;
}) {
  const { brandSlug } = await params;
  const access = await requireBrandPage(brandSlug);
  const brandId = access.brand.id;

  const [posts, accounts, contributors, campaigns, cookieStore] = await Promise.all([
    listBrandPosts(brandId),
    db.socialAccount.findMany({
      where: { brandId, isActive: true },
      select: { id: true, name: true, platform: true },
      orderBy: [{ platform: "asc" }, { name: "asc" }],
    }),
    db.contributor.findMany({
      where: { brandId, isActive: true },
      select: { id: true, firstName: true, lastName: true },
      orderBy: { firstName: "asc" },
    }),
    db.campaign.findMany({
      where: { brandId, archivedAt: null, status: { in: ["DRAFT", "ACTIVE"] } },
      select: { id: true, name: true },
      orderBy: { updatedAt: "desc" },
    }),
    cookies(),
  ]);
  const view = cookieStore.get(CALENDAR_VIEW_COOKIE)?.value as CalendarView | undefined;

  return (
    <>
      <PageHeader
        title={planningCopy.brandCalendar.title}
        description={planningCopy.brandCalendar.description}
      />
      <PageBody>
        <BrandPlanning
          brandSlug={brandSlug}
          posts={posts.map(({ campaign, ...p }) => ({ ...p, campaignName: campaign.name }))}
          options={{ accounts, contributors, contents: [], campaigns }}
          timezone={access.brand.timezone}
          canEdit={access.can("campaign.edit")}
          initialMode={
            cookieStore.get(PLANNING_MODE_COOKIE)?.value === "list" ? "list" : "calendar"
          }
          initialView={view && VIEWS.includes(view) ? view : "dayGridMonth"}
          initialDate={todayLocal(access.brand.timezone)}
        />
      </PageBody>
    </>
  );
}
