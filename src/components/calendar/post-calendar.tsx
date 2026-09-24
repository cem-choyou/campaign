"use client";

import type { EventClickArg, EventContentArg, EventDropArg, EventInput } from "@fullcalendar/core";
import frLocale from "@fullcalendar/core/locales/fr";
import dayGridPlugin from "@fullcalendar/daygrid";
import interactionPlugin, { type DateClickArg } from "@fullcalendar/interaction";
import listPlugin from "@fullcalendar/list";
import FullCalendar from "@fullcalendar/react";
import timeGridPlugin from "@fullcalendar/timegrid";
import { Check, ChevronLeft, ChevronRight, Lock } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { PlatformIcon } from "@/components/brand/platform-icon";
import { Button } from "@/components/ui/button";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { postFormatLabels, postStatusLabels } from "@/lib/copy/common";
import { planningCopy } from "@/lib/copy/planning";
import { toLocalParts } from "@/lib/dates";
import { isLocked } from "@/lib/posts";
import { CALENDAR_VIEW_COOKIE, writePreferenceCookie } from "@/lib/preferences/cookies";
import { cn } from "@/lib/utils";
import { type PlanningPost, platformOfPost, postTitle, publisherLabel } from "./types";

const copy = planningCopy;

export type CalendarView = "dayGridMonth" | "timeGridWeek" | "listMonth";

const VIEWS: { value: CalendarView; label: string }[] = [
  { value: "dayGridMonth", label: copy.views.month },
  { value: "timeGridWeek", label: copy.views.week },
  { value: "listMonth", label: copy.views.list },
];

/**
 * FullCalendar runs in "UTC" and receives brand-local wall-clock times: what the grid shows is
 * exactly the brand's local time, whatever the viewer's own time zone (§6.4).
 */
function wallClock(instant: Date, timeZone: string): string {
  const { date, time } = toLocalParts(instant, timeZone);
  return `${date}T${time}:00Z`;
}

function splitWallClock(date: Date): { date: string; time: string } {
  const iso = date.toISOString();
  return { date: iso.slice(0, 10), time: iso.slice(11, 16) };
}

export function PostCalendar({
  posts,
  timezone,
  initialView,
  initialDate,
  canEdit,
  showCampaign,
  onOpenPost,
  onMovePost,
  onCreateAt,
}: {
  posts: PlanningPost[];
  timezone: string;
  initialView: CalendarView;
  initialDate?: string;
  canEdit: boolean;
  showCampaign?: boolean;
  onOpenPost: (post: PlanningPost) => void;
  onMovePost: (post: PlanningPost, date: string, time: string, revert: () => void) => void;
  onCreateAt?: (date: string, time?: string) => void;
}) {
  const calendarRef = useRef<FullCalendar>(null);
  const [view, setView] = useState<CalendarView>(initialView);
  const [title, setTitle] = useState("");
  const nowWall = wallClock(new Date(), timezone);
  const byId = useMemo(() => new Map(posts.map((p) => [p.id, p])), [posts]);

  const events: EventInput[] = useMemo(
    () =>
      posts
        .filter((p) => p.status !== "CANCELLED")
        .map((p) => ({
          id: p.id,
          start: wallClock(p.scheduledAt, timezone),
          allDay: false,
          editable: canEdit && !isLocked(p.status),
          classNames: ["post-event", `post-event--${p.status.toLowerCase()}`],
        })),
    [posts, timezone, canEdit],
  );

  const api = () => calendarRef.current?.getApi();

  const changeView = (next: CalendarView) => {
    setView(next);
    api()?.changeView(next);
    writePreferenceCookie(CALENDAR_VIEW_COOKIE, next);
  };

  const renderEvent = (arg: EventContentArg) => {
    const post = byId.get(arg.event.id);
    if (!post) return null;
    const time = toLocalParts(post.scheduledAt, timezone).time;
    const excerpt = post.body?.trim() || post.youtubeTitle || copy.noText;
    const label = `${time} · ${postFormatLabels[post.format]} · ${postTitle(post)} · ${postStatusLabels[post.status]}`;
    return (
      <Tooltip delayDuration={400}>
        <TooltipTrigger asChild>
          <div
            className="flex w-full min-w-0 items-center gap-1 overflow-hidden px-1 py-0.5"
            aria-label={label}
          >
            <PlatformIcon platform={platformOfPost(post)} className="size-3 shrink-0" />
            <span className="tabular shrink-0 font-medium">{time}</span>
            <span className="truncate">
              {post.content?.code ? `${post.content.code} · ` : ""}
              {postTitle(post)}
            </span>
            {post.status === "PUBLISHED" && (
              <Check className="ml-auto size-3 shrink-0" aria-hidden />
            )}
            {post.status === "PROCESSING" && (
              <Lock className="ml-auto size-3 shrink-0" aria-hidden />
            )}
          </div>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-72 text-left">
          <p className="font-medium">
            {postFormatLabels[post.format]} · {publisherLabel(post)}
            {showCampaign && post.campaignName ? ` · ${post.campaignName}` : ""}
          </p>
          <p className="mt-1 line-clamp-4 whitespace-pre-line opacity-90">{excerpt}</p>
          <p className="mt-1 opacity-70">{postStatusLabels[post.status]}</p>
        </TooltipContent>
      </Tooltip>
    );
  };

  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="icon"
            aria-label={copy.previous}
            onClick={() => api()?.prev()}
          >
            <ChevronLeft aria-hidden />
          </Button>
          <Button
            variant="outline"
            size="icon"
            aria-label={copy.next}
            onClick={() => api()?.next()}
          >
            <ChevronRight aria-hidden />
          </Button>
          <Button variant="outline" onClick={() => api()?.today()}>
            {copy.today}
          </Button>
        </div>
        <h2
          className="min-w-0 flex-1 truncate text-base font-semibold capitalize"
          aria-live="polite"
        >
          {title}
        </h2>
        <ToggleGroup
          type="single"
          variant="outline"
          size="sm"
          value={view}
          aria-label={copy.viewLabel}
          onValueChange={(v) => v && changeView(v as CalendarView)}
        >
          {VIEWS.map((v) => (
            <ToggleGroupItem key={v.value} value={v.value} className="px-3">
              {v.label}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </div>

      <div className={cn("campaign-calendar", view === "listMonth" && "campaign-calendar--list")}>
        <FullCalendar
          ref={calendarRef}
          plugins={[dayGridPlugin, timeGridPlugin, listPlugin, interactionPlugin]}
          initialView={initialView}
          initialDate={initialDate}
          locale={frLocale}
          timeZone="UTC"
          now={nowWall}
          firstDay={1}
          headerToolbar={false}
          height="auto"
          fixedWeekCount={false}
          dayMaxEvents={4}
          nowIndicator
          slotMinTime="07:00:00"
          slotMaxTime="21:00:00"
          scrollTime="08:00:00"
          allDaySlot={false}
          defaultTimedEventDuration="00:30"
          displayEventEnd={false}
          eventDurationEditable={false}
          editable={canEdit}
          selectable={false}
          events={events}
          eventContent={renderEvent}
          eventOrder="start"
          eventDisplay="block"
          datesSet={(arg) => setTitle(arg.view.title)}
          eventAllow={(span) => span.start.toISOString() > nowWall}
          eventDrop={(arg: EventDropArg) => {
            const post = byId.get(arg.event.id);
            if (!post || !arg.event.start) return arg.revert();
            const { date, time } = splitWallClock(arg.event.start);
            onMovePost(post, date, time, arg.revert);
          }}
          eventClick={(arg: EventClickArg) => {
            arg.jsEvent.preventDefault();
            const post = byId.get(arg.event.id);
            if (post) onOpenPost(post);
          }}
          dateClick={(arg: DateClickArg) => {
            if (!canEdit || !onCreateAt) return;
            const { date, time } = splitWallClock(arg.date);
            if (`${date}T23:59:00Z` < nowWall) return;
            onCreateAt(date, arg.allDay ? undefined : time);
          }}
          noEventsContent={copy.emptyTitle}
        />
      </div>
    </div>
  );
}
