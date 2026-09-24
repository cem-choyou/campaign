"use client";

import { CalendarDays, List, MousePointerClick } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useState } from "react";
import { toast } from "sonner";
import {
  deletePostsAction,
  movePostAction,
  restorePostDatesAction,
  restorePostsAction,
  setPostsTimeAction,
  shiftPostsAction,
} from "@/app/(app)/[brandSlug]/campagnes/post-actions";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { common } from "@/lib/copy/common";
import { planningCopy } from "@/lib/copy/planning";
import { formatDayLong, localToUtc, todayLocal } from "@/lib/dates";
import { PLANNING_MODE_COOKIE, writePreferenceCookie } from "@/lib/preferences/cookies";
import { type CalendarView, PostCalendar } from "./post-calendar";
import { PostTable } from "./post-table";
import { QuickCreateDialog, type QuickCreateTarget } from "./quick-create-dialog";
import type { PlanningOptions, PlanningPost } from "./types";

const copy = planningCopy;

export type PlanningMode = "calendar" | "list";

export function PlanningView({
  posts: serverPosts,
  options,
  timezone,
  campaignId,
  canEdit,
  initialMode,
  initialView,
  initialDate,
  showCampaign,
  campaignHref,
  toolbar,
  children,
}: {
  posts: PlanningPost[];
  options: PlanningOptions;
  timezone: string;
  campaignId: string | null;
  canEdit: boolean;
  initialMode: PlanningMode;
  initialView: CalendarView;
  initialDate?: string;
  showCampaign?: boolean;
  /** Where a post opens: the campaign page of that post (brand calendar) or the current page. */
  campaignHref?: (campaignId: string) => string;
  /** Extra actions on the right of the mode switch (import, AI writing…). */
  toolbar?: React.ReactNode;
  /** Post editor panel (rendered by the page). */
  children?: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [mode, setMode] = useState<PlanningMode>(initialMode);

  // Local copy for optimistic updates, re-synced whenever the server sends new posts.
  const [posts, setPosts] = useState(serverPosts);
  const [synced, setSynced] = useState(serverPosts);
  if (synced !== serverPosts) {
    setSynced(serverPosts);
    setPosts(serverPosts);
  }

  const wantsCreate = searchParams.get("nouveau") === "1";
  const [createTarget, setCreateTarget] = useState<QuickCreateTarget | "open">(null);
  const quickCreate = createTarget ?? (wantsCreate && canEdit ? "open" : null);

  const setQuery = useCallback(
    (update: (params: URLSearchParams) => void, base = pathname) => {
      const params = new URLSearchParams(searchParams.toString());
      update(params);
      const qs = params.toString();
      router.push(qs ? `${base}?${qs}` : base, { scroll: false });
    },
    [router, pathname, searchParams],
  );

  const openPost = (post: PlanningPost) => {
    if (campaignHref && post.campaignId !== campaignId) {
      router.push(`${campaignHref(post.campaignId)}?post=${post.id}`);
      return;
    }
    setQuery((p) => {
      p.set("post", post.id);
      p.delete("nouveau");
    });
  };

  const closeCreate = () => {
    setCreateTarget(null);
    if (wantsCreate) setQuery((p) => p.delete("nouveau"));
  };

  const restoreDates = async (items: { id: string; scheduledAt: string }[]) => {
    const result = await restorePostDatesAction({ items });
    if (!result.ok) return void toast.error(result.error);
    router.refresh();
  };

  const move = async (post: PlanningPost, date: string, time: string, revert: () => void) => {
    const previous = post.scheduledAt;
    const next = localToUtc(date, time, timezone);
    setPosts((list) => list.map((p) => (p.id === post.id ? { ...p, scheduledAt: next } : p)));
    const result = await movePostAction({ postId: post.id, date, time });
    if (!result.ok) {
      revert();
      setPosts((list) => list.map((p) => (p.id === post.id ? { ...p, scheduledAt: previous } : p)));
      return void toast.error(result.error);
    }
    router.refresh();
    toast(copy.moved(formatDayLong(next, timezone)), {
      description: result.data.warning === "SOON" ? copy.movedSoon : undefined,
      duration: 8000,
      action: {
        label: common.actions.undo,
        onClick: () => void restoreDates([{ id: post.id, scheduledAt: previous.toISOString() }]),
      },
    });
  };

  const shift = async (ids: string[], days: number) => {
    const result = await shiftPostsAction({ postIds: ids, days });
    if (!result.ok) {
      toast.error(result.error);
      return false;
    }
    router.refresh();
    toast(copy.bulk.shifted(result.data.moved, days), {
      duration: 8000,
      action: {
        label: common.actions.undo,
        onClick: () => void restoreDates(result.data.previous),
      },
    });
    return true;
  };

  const setTime = async (ids: string[], time: string) => {
    const result = await setPostsTimeAction({ postIds: ids, time });
    if (!result.ok) {
      toast.error(result.error);
      return false;
    }
    router.refresh();
    toast(copy.bulk.timed(result.data.moved, time), {
      duration: 8000,
      action: {
        label: common.actions.undo,
        onClick: () => void restoreDates(result.data.previous),
      },
    });
    return true;
  };

  const remove = async (ids: string[]) => {
    setPosts((list) => list.filter((p) => !ids.includes(p.id)));
    const result = await deletePostsAction({ postIds: ids });
    if (!result.ok) {
      setPosts(serverPosts);
      toast.error(result.error);
      return false;
    }
    router.refresh();
    const deleted = result.data.deleted;
    toast(copy.bulk.deleted(deleted.length), {
      duration: 8000,
      action: {
        label: common.actions.undo,
        onClick: async () => {
          const undo = await restorePostsAction({ postIds: deleted });
          if (!undo.ok) return void toast.error(undo.error);
          router.refresh();
        },
      },
    });
    return true;
  };

  const visible = posts.filter((p) => p.status !== "CANCELLED");

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <ToggleGroup
          type="single"
          variant="outline"
          value={mode}
          aria-label={copy.mode.label}
          onValueChange={(v) => {
            if (!v) return;
            setMode(v as PlanningMode);
            writePreferenceCookie(PLANNING_MODE_COOKIE, v);
          }}
        >
          <ToggleGroupItem value="calendar" className="gap-1.5 px-3">
            <CalendarDays aria-hidden />
            {copy.mode.calendar}
          </ToggleGroupItem>
          <ToggleGroupItem value="list" className="gap-1.5 px-3">
            <List aria-hidden />
            {copy.mode.list}
          </ToggleGroupItem>
        </ToggleGroup>
        {visible.length === 0 && (
          <p className="text-muted-foreground inline-flex items-center gap-2 text-sm">
            <MousePointerClick className="size-4" aria-hidden />
            {campaignId ? copy.emptyBody : copy.emptyBrandBody}
          </p>
        )}
        {toolbar && <div className="ml-auto flex flex-wrap items-center gap-2">{toolbar}</div>}
      </div>

      {mode === "calendar" ? (
        <PostCalendar
          posts={posts}
          timezone={timezone}
          initialView={initialView}
          initialDate={initialDate}
          canEdit={canEdit}
          showCampaign={showCampaign}
          onOpenPost={openPost}
          onMovePost={(post, date, time, revert) => void move(post, date, time, revert)}
          onCreateAt={canEdit ? (date, time) => setCreateTarget({ date, time }) : undefined}
        />
      ) : (
        <PostTable
          posts={posts}
          timezone={timezone}
          canEdit={canEdit}
          showCampaign={showCampaign}
          onOpenPost={openPost}
          onShift={shift}
          onSetTime={setTime}
          onDelete={remove}
        />
      )}

      {quickCreate && (
        <QuickCreateDialog
          key={quickCreate === "open" ? "open" : `${quickCreate.date}-${quickCreate.time}`}
          target={quickCreate}
          onClose={closeCreate}
          options={options}
          campaignId={campaignId}
          timezone={timezone}
          defaultDate={
            initialDate && initialDate > todayLocal(timezone) ? initialDate : todayLocal(timezone)
          }
          onCreated={(postId, createdIn) => {
            setCreateTarget(null);
            if (campaignHref && createdIn !== campaignId) {
              router.push(`${campaignHref(createdIn)}?post=${postId}`);
              return;
            }
            router.refresh();
            setQuery((p) => {
              p.set("post", postId);
              p.delete("nouveau");
            });
          }}
        />
      )}

      {children}
    </div>
  );
}
