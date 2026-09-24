"use client";

import {
  Archive,
  ArchiveRestore,
  Copy,
  LayoutGrid,
  Loader2,
  Megaphone,
  MoreHorizontal,
  Pencil,
  Plus,
  Rows3,
  Search,
  Trash2,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import {
  deleteCampaignAction,
  duplicateCampaignAction,
  renameCampaignAction,
  setCampaignArchivedAction,
} from "@/app/(app)/[brandSlug]/campagnes/actions";
import { PlatformIcon } from "@/components/brand/platform-icon";
import { EmptyState } from "@/components/empty-states/empty-state";
import { Field } from "@/components/forms/field";
import { InlineEdit } from "@/components/forms/inline-edit";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { WIZARD_DONE } from "@/lib/campaigns";
import { campaignsCopy } from "@/lib/copy/campaigns";
import { common, platformLabels } from "@/lib/copy/common";
import { formatDateOnlyShort, formatDayTime, mondayOf, todayLocal } from "@/lib/dates";
import { CAMPAIGNS_VIEW_COOKIE, writePreferenceCookie } from "@/lib/preferences/cookies";
import { cn } from "@/lib/utils";
import { CampaignStatusBadge } from "./status-badge";

const copy = campaignsCopy;

export type CampaignCard = {
  id: string;
  name: string;
  status: "DRAFT" | "ACTIVE" | "COMPLETED" | "ARCHIVED";
  startDate: Date | null;
  endDate: Date | null;
  wizardStep: number;
  archivedAt: Date | null;
  stats: {
    total: number;
    published: number;
    progress: number;
    platforms: ("LINKEDIN" | "YOUTUBE")[];
    nextPostAt: Date | null;
  };
};

export type CampaignFilterKey = "all" | "DRAFT" | "ACTIVE" | "COMPLETED" | "ARCHIVED";

function normalize(value: string) {
  return value.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

export function CampaignList({
  brandSlug,
  campaigns,
  counts,
  filter,
  initialView,
  timezone,
  canEdit,
}: {
  brandSlug: string;
  campaigns: CampaignCard[];
  counts: Record<CampaignFilterKey, number>;
  filter: CampaignFilterKey;
  initialView: "cards" | "table";
  timezone: string;
  canEdit: boolean;
}) {
  const router = useRouter();
  const [view, setView] = useState(initialView);
  const [query, setQuery] = useState("");
  const [renaming, setRenaming] = useState<string | null>(null);
  const [duplicating, setDuplicating] = useState<CampaignCard | null>(null);
  const [deleting, setDeleting] = useState<CampaignCard | null>(null);
  const [, startTransition] = useTransition();
  const base = `/${brandSlug}/campagnes`;

  const visible = useMemo(() => {
    const q = normalize(query.trim());
    return q ? campaigns.filter((c) => normalize(c.name).includes(q)) : campaigns;
  }, [campaigns, query]);

  const hrefFor = (c: CampaignCard) =>
    c.status === "DRAFT" && c.wizardStep < WIZARD_DONE && !c.archivedAt
      ? `${base}/${c.id}/assistant`
      : `${base}/${c.id}`;

  const rename = async (c: CampaignCard, name: string) => {
    const result = await renameCampaignAction({ campaignId: c.id, name });
    if (!result.ok) {
      toast.error(result.error);
      return false;
    }
    toast.success(copy.renamed);
    router.refresh();
    return true;
  };

  const setArchived = (c: CampaignCard, archived: boolean) =>
    startTransition(async () => {
      const result = await setCampaignArchivedAction({ campaignId: c.id, archived });
      if (!result.ok) return void toast.error(result.error);
      router.refresh();
      toast(archived ? copy.archived(c.name) : copy.unarchived(c.name), {
        duration: 8000,
        action: { label: common.actions.undo, onClick: () => setArchived(c, !archived) },
      });
    });

  const menu = (c: CampaignCard) =>
    canEdit ? (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            aria-label={common.actionsFor(c.name)}
            className="relative z-10"
          >
            <MoreHorizontal aria-hidden />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" onCloseAutoFocus={(e) => renaming && e.preventDefault()}>
          <DropdownMenuItem onSelect={() => setRenaming(c.id)}>
            <Pencil aria-hidden />
            {copy.menu.rename}
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => setDuplicating(c)}>
            <Copy aria-hidden />
            {copy.menu.duplicate}
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => setArchived(c, !c.archivedAt)}>
            {c.archivedAt ? <ArchiveRestore aria-hidden /> : <Archive aria-hidden />}
            {c.archivedAt ? copy.menu.unarchive : copy.menu.archive}
          </DropdownMenuItem>
          {c.status === "DRAFT" && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive" onSelect={() => setDeleting(c)}>
                <Trash2 aria-hidden />
                {copy.menu.delete}
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    ) : null;

  const nameCell = (c: CampaignCard, className?: string) => (
    <InlineEdit
      value={c.name}
      label={copy.inlineRename.label}
      hint={copy.inlineRename.hint}
      disabled={!canEdit}
      editing={renaming === c.id}
      onEditingChange={(editing) => setRenaming(editing ? c.id : null)}
      onSave={(name) => rename(c, name)}
      className={cn("relative z-10 font-medium", className)}
    />
  );

  const dates = (c: CampaignCard) =>
    c.startDate
      ? copy.datesRange(
          formatDateOnlyShort(c.startDate),
          c.endDate ? formatDateOnlyShort(c.endDate) : undefined,
        )
      : copy.noDates;

  const channels = (c: CampaignCard) => (
    <span className="text-muted-foreground flex items-center gap-1.5">
      {c.stats.platforms.map((p) => (
        <span key={p} title={platformLabels[p]}>
          <PlatformIcon platform={p} className="size-3.5" />
          <span className="sr-only">{platformLabels[p]}</span>
        </span>
      ))}
    </span>
  );

  if (counts.all === 0 && counts.ARCHIVED === 0) {
    return (
      <EmptyState
        icon={Megaphone}
        title={copy.empty.title}
        body={copy.empty.body}
        action={
          canEdit && (
            <Button asChild size="lg">
              <Link href={`${base}/nouvelle`}>
                <Plus aria-hidden />
                {copy.create}
              </Link>
            </Button>
          )
        }
      />
    );
  }

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-4">
      {/* Toolbar */}
      <div className="flex min-w-0 flex-col gap-3 lg:flex-row lg:items-center">
        <nav
          aria-label={copy.filterLabel}
          className="-mx-1 flex max-w-full min-w-0 gap-1 overflow-x-auto px-1 pb-0.5"
        >
          {(Object.keys(copy.filters) as CampaignFilterKey[]).map((key) => (
            <Link
              key={key}
              href={key === "all" ? base : `${base}?statut=${key.toLowerCase()}`}
              aria-current={filter === key ? "page" : undefined}
              className={cn(
                "focus-visible:ring-ring inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-sm whitespace-nowrap transition-colors outline-none focus-visible:ring-2",
                filter === key
                  ? "border-foreground bg-foreground text-background"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted",
              )}
            >
              {copy.filters[key]}
              <span className="tabular text-xs opacity-70">{counts[key]}</span>
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-2 lg:ml-auto">
          <div className="relative min-w-0 flex-1 lg:flex-none">
            <Search
              className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2"
              aria-hidden
            />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={copy.searchPlaceholder}
              aria-label={copy.searchPlaceholder}
              className="h-8 w-full pl-8 lg:w-56"
            />
          </div>
          <ToggleGroup
            type="single"
            variant="outline"
            size="sm"
            value={view}
            aria-label={copy.view.label}
            onValueChange={(v) => {
              if (!v) return;
              setView(v as typeof view);
              writePreferenceCookie(CAMPAIGNS_VIEW_COOKIE, v);
            }}
            className="hidden sm:flex"
          >
            <ToggleGroupItem value="cards" aria-label={copy.view.cards}>
              <LayoutGrid aria-hidden />
            </ToggleGroupItem>
            <ToggleGroupItem value="table" aria-label={copy.view.table}>
              <Rows3 aria-hidden />
            </ToggleGroupItem>
          </ToggleGroup>
        </div>
      </div>

      {visible.length === 0 ? (
        <EmptyState
          icon={Search}
          title={copy.emptyFiltered.title}
          body={copy.emptyFiltered.body}
          action={
            <Button asChild variant="outline" onClick={() => setQuery("")}>
              <Link href={base}>{copy.emptyFiltered.reset}</Link>
            </Button>
          }
        />
      ) : view === "cards" ? (
        <ul className="grid grid-cols-[minmax(0,1fr)] gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {visible.map((c) => {
            const resumable = hrefFor(c).endsWith("/assistant");
            return (
              <li
                key={c.id}
                className="group bg-card hover:border-foreground/20 relative flex flex-col gap-3 rounded-xl border p-4 shadow-[var(--shadow-soft)] transition-colors"
              >
                <Link
                  href={hrefFor(c)}
                  className="focus-visible:ring-ring absolute inset-0 rounded-xl outline-none focus-visible:ring-2"
                  aria-label={`${resumable ? copy.resume : copy.open} : ${c.name}`}
                />
                <div className="flex items-start gap-2">
                  <div className="min-w-0 flex-1">
                    {nameCell(c, "text-base")}
                    <p className="text-muted-foreground mt-0.5 text-xs">{dates(c)}</p>
                  </div>
                  {menu(c)}
                </div>
                <div className="flex items-center gap-2">
                  <CampaignStatusBadge status={c.status} archived={!!c.archivedAt} />
                  {channels(c)}
                </div>
                <div className="mt-auto grid gap-1.5">
                  <Progress
                    value={c.stats.progress * 100}
                    aria-label={copy.progress(c.stats.published, c.stats.total)}
                    className="h-1.5"
                  />
                  <div className="text-muted-foreground flex items-center justify-between gap-2 text-xs">
                    <span className="tabular">
                      {copy.progress(c.stats.published, c.stats.total)}
                    </span>
                    {resumable ? (
                      <span className="text-brand font-medium">
                        {copy.resume} · {copy.resumeHint(c.wizardStep)}
                      </span>
                    ) : (
                      <span className="tabular truncate">
                        {c.stats.nextPostAt
                          ? copy.next(formatDayTime(c.stats.nextPostAt, timezone))
                          : copy.noNext}
                      </span>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      ) : (
        <div className="overflow-x-auto rounded-xl border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-muted-foreground text-left text-xs">
              <tr>
                <th className="px-4 py-2.5 font-medium">{copy.columns.name}</th>
                <th className="px-4 py-2.5 font-medium">{copy.columns.status}</th>
                <th className="px-4 py-2.5 font-medium">{copy.columns.dates}</th>
                <th className="px-4 py-2.5 font-medium">{copy.columns.progress}</th>
                <th className="px-4 py-2.5 font-medium">{copy.columns.channels}</th>
                <th className="px-4 py-2.5 font-medium">{copy.columns.next}</th>
                <th className="w-12" />
              </tr>
            </thead>
            <tbody className="divide-y">
              {visible.map((c) => (
                <tr key={c.id} className="hover:bg-muted/40 relative">
                  <td className="max-w-80 px-4 py-2.5">
                    <Link
                      href={hrefFor(c)}
                      className="focus-visible:ring-ring absolute inset-0 outline-none focus-visible:ring-2 focus-visible:ring-inset"
                      aria-label={`${copy.open} : ${c.name}`}
                    />
                    {nameCell(c)}
                  </td>
                  <td className="px-4 py-2.5">
                    <CampaignStatusBadge status={c.status} archived={!!c.archivedAt} />
                  </td>
                  <td className="text-muted-foreground px-4 py-2.5 whitespace-nowrap">
                    {dates(c)}
                  </td>
                  <td className="tabular text-muted-foreground px-4 py-2.5 whitespace-nowrap">
                    {copy.progress(c.stats.published, c.stats.total)}
                  </td>
                  <td className="px-4 py-2.5">{channels(c)}</td>
                  <td className="tabular text-muted-foreground px-4 py-2.5 whitespace-nowrap">
                    {c.stats.nextPostAt ? formatDayTime(c.stats.nextPostAt, timezone) : "—"}
                  </td>
                  <td className="px-2 py-1.5 text-right">{menu(c)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <DuplicateDialog
        key={duplicating?.id ?? "none"}
        campaign={duplicating}
        timezone={timezone}
        onClose={() => setDuplicating(null)}
        onDone={(id) => router.push(`${base}/${id}`)}
      />

      <AlertDialog open={deleting !== null} onOpenChange={(open) => !open && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{deleting && copy.delete.title(deleting.name)}</AlertDialogTitle>
            <AlertDialogDescription>{copy.delete.body}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{common.actions.cancel}</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() =>
                deleting &&
                startTransition(async () => {
                  const result = await deleteCampaignAction({ campaignId: deleting.id });
                  setDeleting(null);
                  if (!result.ok) return void toast.error(result.error);
                  toast.success(copy.delete.done);
                  router.refresh();
                })
              }
            >
              {copy.delete.submit}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function DuplicateDialog({
  campaign,
  timezone,
  onClose,
  onDone,
}: {
  campaign: CampaignCard | null;
  timezone: string;
  onClose: () => void;
  onDone: (id: string) => void;
}) {
  const [startDate, setStartDate] = useState("");
  const [pending, startTransition] = useTransition();
  const isMonday = !startDate || mondayOf(startDate) === startDate;

  const submit = () =>
    startTransition(async () => {
      if (!campaign) return;
      const result = await duplicateCampaignAction({ campaignId: campaign.id, startDate });
      if (!result.ok) return void toast.error(result.error);
      onClose();
      toast.success(copy.duplicate.done(result.data.name), {
        action: { label: copy.duplicate.openCopy, onClick: () => onDone(result.data.id) },
      });
    });

  return (
    <Dialog open={campaign !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          <DialogHeader>
            <DialogTitle>{copy.duplicate.title}</DialogTitle>
            <DialogDescription>{copy.duplicate.description}</DialogDescription>
          </DialogHeader>
          <div className="my-5">
            <Field
              label={copy.duplicate.shift}
              hint={
                !isMonday
                  ? copy.duplicate.notMonday
                  : campaign?.startDate
                    ? copy.duplicate.shiftHint
                    : copy.duplicate.shiftNone
              }
            >
              {(p) => (
                <Input
                  {...p}
                  type="date"
                  value={startDate}
                  min={todayLocal(timezone)}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-48"
                />
              )}
            </Field>
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={onClose}>
              {common.actions.cancel}
            </Button>
            <Button type="submit" disabled={pending}>
              {pending && <Loader2 className="animate-spin" aria-hidden />}
              {copy.duplicate.submit}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
