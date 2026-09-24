"use client";

import { ArrowDown, ArrowUp, CalendarClock, Clock, Loader2, Trash2, X } from "lucide-react";
import { useMemo, useState, useTransition } from "react";
import { PlatformIcon } from "@/components/brand/platform-icon";
import { PostStatusBadge } from "@/components/campaigns/status-badge";
import { Field } from "@/components/forms/field";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { postFormatLabels } from "@/lib/copy/common";
import { planningCopy } from "@/lib/copy/planning";
import { formatDay, formatTime } from "@/lib/dates";
import { isLocked } from "@/lib/posts";
import { cn } from "@/lib/utils";
import { type PlanningPost, postTitle, publisherLabel } from "./types";

const copy = planningCopy;
type SortKey = "date" | "channel" | "format" | "content" | "status";

const STATUS_ORDER = [
  "DRAFT",
  "IN_REVIEW",
  "APPROVED",
  "PROCESSING",
  "PUBLISHED",
  "FAILED",
  "CANCELLED",
];

function compare(a: PlanningPost, b: PlanningPost, key: SortKey): number {
  switch (key) {
    case "date":
      return a.scheduledAt.getTime() - b.scheduledAt.getTime();
    case "channel":
      return publisherLabel(a).localeCompare(publisherLabel(b), "fr");
    case "format":
      return postFormatLabels[a.format].localeCompare(postFormatLabels[b.format], "fr");
    case "content":
      return (a.content?.code ?? "").localeCompare(b.content?.code ?? "", "fr", { numeric: true });
    case "status":
      return STATUS_ORDER.indexOf(a.status) - STATUS_ORDER.indexOf(b.status);
  }
}

/** Dense sortable table with multi-select and bulk actions (§8.6). */
export function PostTable({
  posts,
  timezone,
  canEdit,
  showCampaign,
  onOpenPost,
  onShift,
  onSetTime,
  onDelete,
}: {
  posts: PlanningPost[];
  timezone: string;
  canEdit: boolean;
  showCampaign?: boolean;
  onOpenPost: (post: PlanningPost) => void;
  onShift: (ids: string[], days: number) => Promise<boolean>;
  onSetTime: (ids: string[], time: string) => Promise<boolean>;
  onDelete: (ids: string[]) => Promise<boolean>;
}) {
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: "date", dir: 1 });
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [pending, startTransition] = useTransition();
  const [days, setDays] = useState("7");
  const [time, setTime] = useState("09:00");

  const rows = useMemo(
    () =>
      [...posts]
        .filter((p) => p.status !== "CANCELLED")
        .sort((a, b) => compare(a, b, sort.key) * sort.dir),
    [posts, sort],
  );
  const selectable = rows.filter((p) => !isLocked(p.status));
  const allSelected = selectable.length > 0 && selectable.every((p) => selected.has(p.id));
  const ids = [...selected].filter((id) => rows.some((r) => r.id === id));

  const toggle = (id: string) =>
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const run = (fn: () => Promise<boolean>) =>
    startTransition(async () => {
      if (await fn()) setSelected(new Set());
    });

  const header = (key: SortKey, label: string) => (
    <th
      scope="col"
      className="px-3 py-2.5 font-medium"
      aria-sort={sort.key === key ? (sort.dir === 1 ? "ascending" : "descending") : "none"}
    >
      <button
        type="button"
        onClick={() => setSort((s) => ({ key, dir: s.key === key ? (-s.dir as 1 | -1) : 1 }))}
        className="hover:text-foreground inline-flex items-center gap-1"
        aria-label={copy.table.sortBy(label)}
      >
        {label}
        {sort.key === key &&
          (sort.dir === 1 ? (
            <ArrowUp className="size-3" aria-hidden />
          ) : (
            <ArrowDown className="size-3" aria-hidden />
          ))}
      </button>
    </th>
  );

  return (
    <div className="grid gap-3">
      {canEdit && ids.length > 0 && (
        <div
          className="bg-foreground text-background flex flex-wrap items-center gap-2 rounded-lg px-3 py-2 text-sm"
          role="toolbar"
          aria-label={copy.table.selected(ids.length)}
        >
          <span className="font-medium">{copy.table.selected(ids.length)}</span>
          <Button
            size="sm"
            variant="ghost"
            className="hover:bg-background/15 hover:text-background text-background"
            onClick={() => setSelected(new Set())}
          >
            <X aria-hidden />
            {copy.table.clear}
          </Button>
          <div className="ml-auto flex flex-wrap gap-1.5">
            <Popover>
              <PopoverTrigger asChild>
                <Button size="sm" variant="secondary" disabled={pending}>
                  <CalendarClock aria-hidden />
                  {copy.bulk.shift}
                </Button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-72">
                <form
                  className="grid gap-3"
                  onSubmit={(e) => {
                    e.preventDefault();
                    const n = Number.parseInt(days, 10);
                    if (Number.isFinite(n) && n !== 0) run(() => onShift(ids, n));
                  }}
                >
                  <p className="text-sm font-medium">{copy.bulk.shiftTitle}</p>
                  <Field label={copy.bulk.shiftDays} hint={copy.bulk.shiftHint}>
                    {(p) => (
                      <Input
                        {...p}
                        type="number"
                        min={-365}
                        max={365}
                        value={days}
                        onChange={(e) => setDays(e.target.value)}
                      />
                    )}
                  </Field>
                  <Button type="submit" size="sm" disabled={pending}>
                    {copy.bulk.shiftSubmit}
                  </Button>
                </form>
              </PopoverContent>
            </Popover>
            <Popover>
              <PopoverTrigger asChild>
                <Button size="sm" variant="secondary" disabled={pending}>
                  <Clock aria-hidden />
                  {copy.bulk.time}
                </Button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-64">
                <form
                  className="grid gap-3"
                  onSubmit={(e) => {
                    e.preventDefault();
                    run(() => onSetTime(ids, time));
                  }}
                >
                  <p className="text-sm font-medium">{copy.bulk.timeTitle}</p>
                  <Field label={copy.bulk.timeLabel}>
                    {(p) => (
                      <Input
                        {...p}
                        type="time"
                        step={300}
                        value={time}
                        onChange={(e) => setTime(e.target.value)}
                      />
                    )}
                  </Field>
                  <Button type="submit" size="sm" disabled={pending}>
                    {copy.bulk.timeSubmit}
                  </Button>
                </form>
              </PopoverContent>
            </Popover>
            <Button
              size="sm"
              variant="destructive"
              disabled={pending}
              onClick={() => run(() => onDelete(ids))}
            >
              {pending ? <Loader2 className="animate-spin" aria-hidden /> : <Trash2 aria-hidden />}
              {copy.bulk.delete}
            </Button>
          </div>
        </div>
      )}

      <div className="overflow-x-auto rounded-xl border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-muted-foreground text-left text-xs">
            <tr>
              {canEdit && (
                <th scope="col" className="w-10 px-3 py-2.5">
                  <Checkbox
                    aria-label={copy.table.selectAll}
                    checked={allSelected}
                    onCheckedChange={(v) =>
                      setSelected(v === true ? new Set(selectable.map((p) => p.id)) : new Set())
                    }
                  />
                </th>
              )}
              {header("date", copy.table.date)}
              {header("channel", copy.table.channel)}
              {header("format", copy.table.format)}
              {header("content", copy.table.content)}
              {header("status", copy.table.status)}
              <th scope="col" className="px-3 py-2.5 font-medium">
                {copy.table.text}
              </th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {rows.map((p) => (
              <tr
                key={p.id}
                className={cn(
                  "hover:bg-muted/40 cursor-pointer",
                  selected.has(p.id) && "bg-brand/5",
                )}
                onClick={() => onOpenPost(p)}
              >
                {canEdit && (
                  <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
                    <Checkbox
                      aria-label={`${copy.table.select} : ${postTitle(p)}`}
                      checked={selected.has(p.id)}
                      disabled={isLocked(p.status)}
                      onCheckedChange={() => toggle(p.id)}
                    />
                  </td>
                )}
                <td className="tabular px-3 py-2 whitespace-nowrap">
                  <button
                    type="button"
                    className="focus-visible:ring-ring rounded text-left outline-none focus-visible:ring-2"
                    onClick={(e) => {
                      e.stopPropagation();
                      onOpenPost(p);
                    }}
                  >
                    <span className="font-medium">{formatDay(p.scheduledAt, timezone)}</span>{" "}
                    <span className="text-muted-foreground">
                      {formatTime(p.scheduledAt, timezone)}
                    </span>
                  </button>
                </td>
                <td className="px-3 py-2">
                  <span className="inline-flex max-w-48 items-center gap-1.5">
                    <PlatformIcon
                      platform={p.socialAccount?.platform ?? "LINKEDIN"}
                      className="size-3.5 shrink-0"
                    />
                    <span className="truncate">{publisherLabel(p)}</span>
                  </span>
                  {showCampaign && p.campaignName && (
                    <span className="text-muted-foreground block truncate text-xs">
                      {p.campaignName}
                    </span>
                  )}
                </td>
                <td className="text-muted-foreground px-3 py-2 whitespace-nowrap">
                  {postFormatLabels[p.format]}
                </td>
                <td className="max-w-56 px-3 py-2">
                  {p.content ? (
                    <span className="truncate">
                      <span className="font-mono text-xs">{p.content.code}</span>{" "}
                      <span className="text-muted-foreground">{p.content.title}</span>
                    </span>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </td>
                <td className="px-3 py-2">
                  <PostStatusBadge status={p.status} />
                </td>
                <td className="text-muted-foreground max-w-72 truncate px-3 py-2">
                  {p.body?.trim() || p.youtubeTitle || (
                    <span className="italic">{copy.noText}</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
