"use client";

import { AlertCircle, AlertTriangle, CheckCircle2, Undo2 } from "lucide-react";
import { useMemo, useState } from "react";
import { PlatformIcon } from "@/components/brand/platform-icon";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { importCopy } from "@/lib/copy/import";
import { formatDateOnlyShort, formatDay, parseDateOnly } from "@/lib/dates";
import { FORMAT_LABELS } from "@/lib/import/normalize";
import type {
  ImportPreview,
  Issue,
  PreviewChoices,
  PreviewPost,
  RowOverride,
} from "@/lib/import/types";
import { FORMATS_BY_PLATFORM, type PostFormat } from "@/lib/posts";
import { cn } from "@/lib/utils";

const copy = importCopy.preview;
const NONE = "__none";
const NO_CONTENT = "__no_content";

function hasError(post: PreviewPost, field: string) {
  return post.issues.some((i) => i.level === "error" && i.field === field);
}

function IssueLine({ issue }: { issue: Issue }) {
  const Icon = issue.level === "error" ? AlertCircle : AlertTriangle;
  return (
    <li
      className={cn(
        "flex items-start gap-1.5 text-xs",
        issue.level === "error" ? "text-destructive" : "text-status-review",
      )}
    >
      <Icon className="mt-px size-3.5 shrink-0" aria-hidden />
      <span>{issue.message}</span>
    </li>
  );
}

// ---------- Summary ----------

export function PreviewSummary({ preview }: { preview: ImportPreview }) {
  const { counts, campaign } = preview;
  return (
    <div className="grid gap-4 rounded-xl border p-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start">
      <div className="grid min-w-0 gap-1">
        <p className="truncate font-semibold">{campaign.name || "—"}</p>
        <p className="text-muted-foreground text-sm">
          {campaign.startDate
            ? `${copy.startDate} : ${formatDateOnlyShort(parseDateOnly(campaign.startDate))} · `
            : ""}
          {copy.contentsCount(preview.contents.length)} ·{" "}
          {copy.summary(counts.posts, counts.missions)}
        </p>
        <p className="text-muted-foreground text-sm">
          {copy.withText(counts.withText, counts.posts)}
        </p>
        {preview.newContributors.length > 0 && (
          <p className="text-muted-foreground text-sm">
            {copy.newContributors(preview.newContributors.map((c) => c.name).join(", "))}
          </p>
        )}
      </div>
      <div className="flex flex-wrap gap-2" aria-live="polite">
        {counts.errors > 0 ? (
          <span className="bg-status-failed-bg text-status-failed inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-sm font-medium">
            <AlertCircle className="size-4" aria-hidden />
            {copy.errors(counts.errors)}
          </span>
        ) : (
          <span className="bg-status-published-bg text-status-published inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-sm font-medium">
            <CheckCircle2 className="size-4" aria-hidden />
            {copy.allGood}
          </span>
        )}
        {counts.warnings > 0 && (
          <span className="bg-status-review-bg text-status-review inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-sm font-medium">
            <AlertTriangle className="size-4" aria-hidden />
            {copy.warnings(counts.warnings)}
          </span>
        )}
      </div>
      {preview.issues.length > 0 && (
        <ul className="grid gap-1 sm:col-span-2" aria-label={copy.fileIssues}>
          {preview.issues.map((issue, i) => (
            <IssueLine key={i} issue={issue} />
          ))}
        </ul>
      )}
    </div>
  );
}

// ---------- Mini calendar ----------

export function PreviewCalendar({ posts }: { posts: PreviewPost[] }) {
  const weeks = useMemo(() => {
    const dated = posts.filter((p) => p.date && !p.skip);
    if (dated.length === 0) return [];
    const days = dated.map((p) => parseDateOnly(p.date!).getTime()).sort((a, b) => a - b);
    const monday = (t: number) => {
      const d = new Date(t);
      return t - ((d.getUTCDay() + 6) % 7) * 86_400_000;
    };
    const first = monday(days[0]!);
    const last = monday(days.at(-1)!);
    const byDay = new Map<string, PreviewPost[]>();
    for (const p of dated) byDay.set(p.date!, [...(byDay.get(p.date!) ?? []), p]);
    const out: { start: number; days: { date: string; posts: PreviewPost[] }[] }[] = [];
    for (let w = first; w <= last && out.length < 26; w += 7 * 86_400_000) {
      out.push({
        start: w,
        days: Array.from({ length: 7 }, (_, i) => {
          const date = new Date(w + i * 86_400_000).toISOString().slice(0, 10);
          return { date, posts: byDay.get(date) ?? [] };
        }),
      });
    }
    return out;
  }, [posts]);

  if (weeks.length === 0) return null;
  const dayNames = ["lun.", "mar.", "mer.", "jeu.", "ven.", "sam.", "dim."];
  return (
    <div className="overflow-x-auto rounded-xl border">
      <table className="w-full min-w-[36rem] table-fixed text-xs">
        <caption className="sr-only">{copy.calendar}</caption>
        <thead className="bg-muted/50 text-muted-foreground">
          <tr>
            <th scope="col" className="w-20 px-2 py-1.5 text-left font-medium">
              S.
            </th>
            {dayNames.map((d) => (
              <th key={d} scope="col" className="px-2 py-1.5 text-left font-medium">
                {d}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y">
          {weeks.map((week, i) => (
            <tr key={week.start}>
              <th scope="row" className="text-muted-foreground px-2 py-1.5 text-left font-normal">
                S{i + 1} · {new Date(week.start).getUTCDate()}/
                {new Date(week.start).getUTCMonth() + 1}
              </th>
              {week.days.map((day) => (
                <td key={day.date} className="px-1 py-1 align-top">
                  <div className="flex flex-wrap gap-1">
                    {day.posts.map((p) => {
                      const error = p.issues.some((x) => x.level === "error");
                      return (
                        <span
                          key={p.row}
                          title={`${copy.rowLabel(p.row)} · ${p.publisher?.name ?? p.accountLabel}`}
                          className={cn(
                            "inline-flex items-center gap-1 rounded border px-1 py-0.5",
                            error
                              ? "border-destructive/40 bg-status-failed-bg text-status-failed"
                              : p.published
                                ? "bg-status-published-bg text-status-published border-transparent"
                                : "bg-background",
                          )}
                        >
                          <PlatformIcon
                            platform={p.publisher?.platform ?? "LINKEDIN"}
                            className="size-3"
                          />
                          {p.contentCode ?? p.time}
                        </span>
                      );
                    })}
                  </div>
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ---------- Table ----------

export function PreviewTable({
  preview,
  choices,
  timezone,
  overrides,
  onOverride,
}: {
  preview: ImportPreview;
  choices: PreviewChoices;
  timezone: string;
  overrides: Record<number, RowOverride>;
  onOverride: (row: number, patch: RowOverride | null) => void;
}) {
  const hasErrors = preview.counts.errors > 0;
  const [onlyIssues, setOnlyIssues] = useState(hasErrors);
  const rows = onlyIssues
    ? preview.posts.filter((p) => p.issues.length > 0 || p.skip)
    : preview.posts;

  return (
    <div className="grid gap-3">
      <label className="flex w-fit items-center gap-2 text-sm">
        <Checkbox checked={onlyIssues} onCheckedChange={(v) => setOnlyIssues(v === true)} />
        {copy.onlyIssues}
      </label>
      {rows.length === 0 ? (
        <p className="text-muted-foreground rounded-xl border border-dashed p-6 text-center text-sm">
          {copy.empty}
        </p>
      ) : (
        <div className="overflow-x-auto rounded-xl border">
          <table className="w-full min-w-[56rem] text-sm">
            <caption className="sr-only">{copy.table}</caption>
            <thead className="bg-muted/50 text-muted-foreground text-left text-xs">
              <tr>
                {[
                  copy.columns.row,
                  copy.columns.date,
                  copy.columns.publisher,
                  copy.columns.format,
                  copy.columns.content,
                  copy.columns.text,
                  copy.columns.status,
                ].map((label) => (
                  <th key={label} scope="col" className="px-3 py-2 font-medium">
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y">
              {rows.map((post) => (
                <PreviewRow
                  key={post.row}
                  post={post}
                  choices={choices}
                  timezone={timezone}
                  override={overrides[post.row] ?? {}}
                  onOverride={(patch) => onOverride(post.row, patch)}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function PreviewRow({
  post,
  choices,
  timezone,
  override,
  onOverride,
}: {
  post: PreviewPost;
  choices: PreviewChoices;
  timezone: string;
  override: RowOverride;
  onOverride: (patch: RowOverride | null) => void;
}) {
  const label = copy.rowLabel(post.row);
  const errors = post.issues.filter((i) => i.level === "error");
  const fixDate = hasError(post, "date") || override.date !== undefined;
  const fixTime = hasError(post, "time") || override.time !== undefined;
  const fixAccount = hasError(post, "account") || override.publisher !== undefined;
  const fixContent = hasError(post, "content") || override.contentCode !== undefined;
  const fixFormat = hasError(post, "format") || override.format !== undefined;
  const formats: PostFormat[] = post.publisher ? FORMATS_BY_PLATFORM[post.publisher.platform] : [];

  return (
    <tr
      className={cn(
        "align-top",
        post.skip && "opacity-60",
        errors.length && !post.skip && "bg-status-failed-bg/40",
      )}
    >
      <td className="tabular text-muted-foreground px-3 py-2.5 whitespace-nowrap">{post.row}</td>
      <td className="px-3 py-2 whitespace-nowrap">
        {fixDate || fixTime ? (
          <div className="flex gap-1.5">
            <Input
              type="date"
              aria-label={`${label} : ${copy.columns.date}`}
              aria-invalid={hasError(post, "date") || undefined}
              className="h-8 w-36"
              value={override.date ?? post.date ?? ""}
              onChange={(e) => onOverride({ ...override, date: e.target.value })}
            />
            <Input
              type="time"
              step={300}
              aria-label={`${label} : ${copy.columns.time}`}
              aria-invalid={hasError(post, "time") || undefined}
              className="h-8 w-24"
              value={override.time ?? post.time}
              onChange={(e) => onOverride({ ...override, time: e.target.value })}
            />
          </div>
        ) : post.scheduledAt ? (
          <span className="tabular">
            {formatDay(new Date(post.scheduledAt), timezone)} · {post.time}
          </span>
        ) : (
          "—"
        )}
      </td>
      <td className="px-3 py-2">
        {fixAccount ? (
          <Select
            value={override.publisher ?? NONE}
            onValueChange={(v) =>
              onOverride({ ...override, publisher: v === NONE ? undefined : v })
            }
          >
            <SelectTrigger
              aria-label={`${label} : ${copy.columns.publisher}`}
              aria-invalid={hasError(post, "account") || undefined}
              className="h-8 w-48"
            >
              <SelectValue placeholder={copy.chooseAccount} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE} disabled>
                {post.accountLabel ? `« ${post.accountLabel} »` : copy.chooseAccount}
              </SelectItem>
              {choices.accounts.map((a) => (
                <SelectItem key={a.value} value={a.value}>
                  <PlatformIcon platform={a.platform} className="size-3.5" />
                  {a.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : post.publisher ? (
          <span className="inline-flex items-center gap-1.5">
            <PlatformIcon
              platform={post.publisher.platform}
              className="text-muted-foreground size-3.5"
            />
            {post.publisher.name}
          </span>
        ) : (
          post.accountLabel || "—"
        )}
      </td>
      <td className="px-3 py-2 whitespace-nowrap">
        {fixFormat && formats.length > 0 ? (
          <Select
            value={override.format ?? NONE}
            onValueChange={(v) =>
              onOverride({ ...override, format: v === NONE ? undefined : (v as PostFormat) })
            }
          >
            <SelectTrigger
              aria-label={`${label} : ${copy.columns.format}`}
              aria-invalid={hasError(post, "format") || undefined}
              className="h-8 w-36"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE} disabled>
                {post.format ? FORMAT_LABELS[post.format] : "—"}
              </SelectItem>
              {formats.map((f) => (
                <SelectItem key={f} value={f}>
                  {FORMAT_LABELS[f]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : post.format ? (
          FORMAT_LABELS[post.format]
        ) : (
          "—"
        )}
      </td>
      <td className="px-3 py-2">
        {fixContent ? (
          <Select
            value={override.contentCode === undefined ? NONE : (override.contentCode ?? NO_CONTENT)}
            onValueChange={(v) =>
              onOverride({
                ...override,
                contentCode: v === NONE ? undefined : v === NO_CONTENT ? null : v,
              })
            }
          >
            <SelectTrigger
              aria-label={`${label} : ${copy.columns.content}`}
              aria-invalid={hasError(post, "content") || undefined}
              className="h-8 w-44"
            >
              <SelectValue placeholder={copy.chooseContent} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE} disabled>
                {copy.chooseContent}
              </SelectItem>
              <SelectItem value={NO_CONTENT}>{copy.noContent}</SelectItem>
              {choices.contentCodes.map((c) => (
                <SelectItem key={c.code} value={c.code}>
                  {c.code} · {c.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : post.contentCode ? (
          <span>
            <span className="text-muted-foreground font-mono text-xs">{post.contentCode}</span>{" "}
            {post.contentTitle}
          </span>
        ) : (
          "—"
        )}
      </td>
      <td className="text-muted-foreground px-3 py-2.5 whitespace-nowrap">
        {post.published ? copy.published : post.body ? copy.textProvided : copy.textAi}
        {post.relays.length > 0 && (
          <span className="block text-xs">
            {copy.columns.relays} : {post.relays.map((r) => r.name).join(", ")}
          </span>
        )}
      </td>
      <td className="px-3 py-2">
        <div className="grid gap-1.5">
          {post.skip ? (
            <span className="text-muted-foreground text-xs">{copy.skipped}</span>
          ) : post.issues.length === 0 ? (
            <span className="text-status-published inline-flex items-center gap-1 text-xs">
              <CheckCircle2 className="size-3.5" aria-hidden />
              {copy.ok}
            </span>
          ) : (
            <ul className="grid gap-1">
              {post.issues.map((issue, i) => (
                <IssueLine key={i} issue={issue} />
              ))}
            </ul>
          )}
          {(errors.length > 0 || post.skip) && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 w-fit px-2 text-xs"
              onClick={() =>
                onOverride(post.skip ? { ...override, skip: false } : { ...override, skip: true })
              }
            >
              {post.skip && <Undo2 aria-hidden />}
              {post.skip ? copy.unskip : copy.skip}
            </Button>
          )}
        </div>
      </td>
    </tr>
  );
}
