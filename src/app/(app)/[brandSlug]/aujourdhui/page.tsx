import { ArrowRight, CheckCircle2, PenLine, Plus, Sparkles } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { PlatformIcon } from "@/components/brand/platform-icon";
import { PostStatusBadge } from "@/components/campaigns/status-badge";
import { PageBody, PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { WIZARD_DONE } from "@/lib/campaigns";
import { campaignsCopy } from "@/lib/copy/campaigns";
import { postFormatLabels } from "@/lib/copy/common";
import { todayCopy } from "@/lib/copy/today";
import { formatTime, toLocalParts } from "@/lib/dates";
import { requireBrandPage } from "@/server/permissions";
import { getTodayOverview } from "@/server/today";

export const metadata: Metadata = { title: todayCopy.title };

type UpcomingPost = Awaited<ReturnType<typeof getTodayOverview>>["upcoming"][number];

export default async function TodayPage({ params }: { params: Promise<{ brandSlug: string }> }) {
  const { brandSlug } = await params;
  const access = await requireBrandPage(brandSlug);
  const tz = access.brand.timezone;
  const data = await getTodayOverview(access.brand.id, tz);
  const base = `/${brandSlug}`;
  const canEdit = access.can("campaign.edit");
  const firstName = access.user.name?.split(" ")[0] ?? null;
  const greeting = todayCopy.greeting(firstName, data.hour);

  const todays = data.upcoming.filter((p) => toLocalParts(p.scheduledAt, tz).date === data.today);
  const tomorrows = data.upcoming.filter(
    (p) => toLocalParts(p.scheduledAt, tz).date !== data.today,
  );

  if (data.campaigns.length === 0 && data.upcoming.length === 0) {
    return (
      <>
        <PageHeader title={greeting} />
        <PageBody>
          <div className="bg-card mx-auto mt-6 flex max-w-xl flex-col items-center rounded-2xl border px-6 py-12 text-center">
            <div className="bg-brand/10 text-brand mb-5 flex size-14 items-center justify-center rounded-2xl">
              <Sparkles className="size-7" aria-hidden />
            </div>
            <h2 className="text-lg font-semibold">{todayCopy.firstRun.title}</h2>
            <p className="text-muted-foreground mt-2 max-w-md">{todayCopy.firstRun.body}</p>
            {canEdit && (
              <Button asChild size="lg" className="mt-6">
                <Link href={`${base}/campagnes/nouvelle`}>
                  <Plus aria-hidden />
                  {todayCopy.firstRun.create}
                </Link>
              </Button>
            )}
          </div>
        </PageBody>
      </>
    );
  }

  const postRow = (p: UpcomingPost) => {
    const who =
      p.socialAccount?.name ??
      `${p.authorContributor?.firstName ?? ""} ${p.authorContributor?.lastName ?? ""}`.trim();
    const title = p.content?.title ?? p.youtubeTitle ?? p.angle ?? postFormatLabels[p.format];
    return (
      <li key={p.id}>
        <Link
          href={`${base}/campagnes/${p.campaignId}?post=${p.id}`}
          className="hover:bg-muted/60 focus-visible:ring-ring flex items-center gap-3 rounded-lg px-2 py-2 outline-none focus-visible:ring-2"
        >
          <span className="tabular text-muted-foreground w-11 shrink-0 text-sm">
            {formatTime(p.scheduledAt, tz)}
          </span>
          <PlatformIcon
            platform={p.socialAccount?.platform ?? "LINKEDIN"}
            className="text-muted-foreground size-4 shrink-0"
          />
          <span className="min-w-0 flex-1">
            <span className="block truncate font-medium">{title}</span>
            <span className="text-muted-foreground block truncate text-xs">
              {who} · {p.campaign.name}
            </span>
          </span>
          <PostStatusBadge status={p.status} className="hidden sm:inline-flex" />
        </Link>
      </li>
    );
  };

  return (
    <>
      <PageHeader
        title={greeting}
        description={todayCopy.summary(todays.length, tomorrows.length, data.withoutText.length)}
      />
      <PageBody className="grid grid-cols-[minmax(0,1fr)] gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <section className="bg-card rounded-xl border p-4 sm:p-5" aria-labelledby="upcoming-title">
          <div className="mb-3 flex items-center justify-between gap-2">
            <h2 id="upcoming-title" className="font-semibold">
              {todayCopy.upcoming.title}
            </h2>
            <Button asChild variant="ghost" size="sm">
              <Link href={`${base}/calendrier`}>
                {todayCopy.upcoming.openCalendar}
                <ArrowRight aria-hidden />
              </Link>
            </Button>
          </div>
          {data.upcoming.length === 0 ? (
            <p className="text-muted-foreground py-6 text-center">{todayCopy.upcoming.empty}</p>
          ) : (
            <div className="grid grid-cols-[minmax(0,1fr)] gap-4">
              {[
                { label: todayCopy.upcoming.today, items: todays },
                { label: todayCopy.upcoming.tomorrow, items: tomorrows },
              ]
                .filter((g) => g.items.length > 0)
                .map((g) => (
                  <div key={g.label}>
                    <h3 className="text-muted-foreground mb-1 px-2 text-xs font-medium tracking-wide uppercase">
                      {g.label}
                    </h3>
                    <ul>{g.items.map(postRow)}</ul>
                  </div>
                ))}
            </div>
          )}
        </section>

        <div className="grid content-start gap-4">
          <section
            className="bg-card rounded-xl border p-4 sm:p-5"
            aria-labelledby="attention-title"
          >
            <h2 id="attention-title" className="mb-3 font-semibold">
              {todayCopy.attention.title}
            </h2>
            {data.withoutText.length === 0 ? (
              <p className="text-muted-foreground flex items-center gap-2 text-sm">
                <CheckCircle2 className="text-status-published size-4" aria-hidden />
                {todayCopy.attention.allGood}
              </p>
            ) : (
              <div className="bg-status-review-bg flex items-center gap-3 rounded-lg p-3 text-sm">
                <PenLine className="text-status-review size-4 shrink-0" aria-hidden />
                <span className="flex-1">
                  {todayCopy.attention.missingText(data.withoutText.length)}
                </span>
                <Button asChild size="sm" variant="outline">
                  <Link
                    href={`${base}/campagnes/${data.withoutText[0]!.campaignId}?post=${data.withoutText[0]!.id}`}
                  >
                    {todayCopy.attention.missingTextAction}
                  </Link>
                </Button>
              </div>
            )}
          </section>

          <section
            className="bg-card rounded-xl border p-4 sm:p-5"
            aria-labelledby="campaigns-title"
          >
            <div className="mb-3 flex items-center justify-between gap-2">
              <h2 id="campaigns-title" className="font-semibold">
                {todayCopy.campaigns.title}
              </h2>
              <Button asChild variant="ghost" size="sm">
                <Link href={`${base}/campagnes`}>
                  {todayCopy.campaigns.seeAll}
                  <ArrowRight aria-hidden />
                </Link>
              </Button>
            </div>
            {data.campaigns.length === 0 ? (
              <p className="text-muted-foreground text-sm">{todayCopy.campaigns.empty}</p>
            ) : (
              <ul className="grid gap-3">
                {data.campaigns.map((c) => {
                  const resume = c.status === "DRAFT" && c.wizardStep < WIZARD_DONE;
                  return (
                    <li key={c.id}>
                      <Link
                        href={`${base}/campagnes/${c.id}${resume ? "/assistant" : ""}`}
                        className="hover:bg-muted/60 focus-visible:ring-ring block rounded-lg p-2 outline-none focus-visible:ring-2"
                      >
                        <span className="flex items-center justify-between gap-2">
                          <span className="truncate font-medium">{c.name}</span>
                          <span className="text-muted-foreground tabular shrink-0 text-xs">
                            {resume
                              ? todayCopy.campaigns.resume
                              : campaignsCopy.progress(c.stats.published, c.stats.total)}
                          </span>
                        </span>
                        <Progress
                          value={c.stats.progress * 100}
                          className="mt-2 h-1.5"
                          aria-hidden
                        />
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </div>
      </PageBody>
    </>
  );
}
