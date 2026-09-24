"use client";

import { Loader2 } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { createPostAction } from "@/app/(app)/[brandSlug]/campagnes/post-actions";
import { PlatformIcon } from "@/components/brand/platform-icon";
import { Field } from "@/components/forms/field";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { common, postFormatLabels } from "@/lib/copy/common";
import { planningCopy } from "@/lib/copy/planning";
import { DEFAULT_TIME, formatDayLong, localToUtc } from "@/lib/dates";
import { FORMATS_BY_PLATFORM, type Platform, type PostFormat, decodePublisher } from "@/lib/posts";
import type { PlanningOptions } from "./types";

const copy = planningCopy.quickCreate;
const NONE = "__none";

export type QuickCreateTarget = { date: string; time?: string } | null;

/** Small dialog (canal, format, contenu, heure) that creates a post then opens the editor (§8.7). */
export function QuickCreateDialog({
  target,
  onClose,
  onCreated,
  options,
  campaignId,
  timezone,
  defaultDate,
}: {
  target: QuickCreateTarget | "open";
  onClose: () => void;
  onCreated: (postId: string, campaignId: string) => void;
  options: PlanningOptions;
  campaignId: string | null;
  timezone: string;
  defaultDate: string;
}) {
  const open = target !== null;
  const initial = target && target !== "open" ? target : null;
  const firstPublisher = options.accounts[0]
    ? `account:${options.accounts[0].id}`
    : options.contributors[0]
      ? `contributor:${options.contributors[0].id}`
      : "";

  const [publisher, setPublisher] = useState(firstPublisher);
  const [format, setFormat] = useState<PostFormat>("VIDEO_POST");
  const [contentId, setContentId] = useState(NONE);
  const [date, setDate] = useState(initial?.date ?? defaultDate);
  const [time, setTime] = useState(initial?.time ?? DEFAULT_TIME);
  const [campaign, setCampaign] = useState(campaignId ?? options.campaigns?.[0]?.id ?? "");
  const [pending, startTransition] = useTransition();

  const decoded = decodePublisher(publisher);
  const platform: Platform =
    decoded?.kind === "account"
      ? (options.accounts.find((a) => a.id === decoded.id)?.platform ?? "LINKEDIN")
      : "LINKEDIN";
  const formats = FORMATS_BY_PLATFORM[platform];
  const effectiveFormat = formats.includes(format) ? format : formats[0]!;

  const submit = () =>
    startTransition(async () => {
      const result = await createPostAction({
        campaignId: campaign,
        publisher,
        format: effectiveFormat,
        date,
        time,
        contentId: contentId === NONE ? null : contentId,
      });
      if (!result.ok) return void toast.error(result.error);
      if (result.data.warning === "SOON") toast.warning(planningCopy.movedSoon);
      else toast.success(copy.created);
      onCreated(result.data.id, campaign);
    });

  const hasPublishers = options.accounts.length + options.contributors.length > 0;
  let dayLabel = "";
  try {
    dayLabel = formatDayLong(localToUtc(date, time || DEFAULT_TIME, timezone), timezone);
  } catch {
    dayLabel = "";
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="sm:max-w-md">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          <DialogHeader>
            <DialogTitle>{copy.title}</DialogTitle>
            <DialogDescription>
              {initial && dayLabel ? copy.description(dayLabel) : copy.descriptionNoDay}
            </DialogDescription>
          </DialogHeader>

          {!hasPublishers ? (
            <p className="bg-muted my-5 rounded-lg p-3 text-sm">{copy.noPublisher}</p>
          ) : (
            <div className="my-5 grid gap-4">
              {!campaignId && options.campaigns && (
                <Field label={copy.campaign}>
                  {(p) => (
                    <Select value={campaign} onValueChange={setCampaign}>
                      <SelectTrigger id={p.id} className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {options.campaigns!.map((c) => (
                          <SelectItem key={c.id} value={c.id}>
                            {c.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </Field>
              )}
              <Field label={copy.publisher} hint={copy.publisherHint}>
                {(p) => (
                  <Select value={publisher} onValueChange={setPublisher}>
                    <SelectTrigger
                      id={p.id}
                      aria-describedby={p["aria-describedby"]}
                      className="w-full"
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {options.accounts.length > 0 && (
                        <SelectGroup>
                          <SelectLabel>{copy.accounts}</SelectLabel>
                          {options.accounts.map((a) => (
                            <SelectItem key={a.id} value={`account:${a.id}`}>
                              <PlatformIcon platform={a.platform} className="size-3.5" />
                              {a.name}
                            </SelectItem>
                          ))}
                        </SelectGroup>
                      )}
                      {options.contributors.length > 0 && (
                        <SelectGroup>
                          <SelectLabel>{copy.contributors}</SelectLabel>
                          {options.contributors.map((c) => (
                            <SelectItem key={c.id} value={`contributor:${c.id}`}>
                              <PlatformIcon platform="LINKEDIN" className="size-3.5" />
                              {`${c.firstName} ${c.lastName ?? ""}`.trim()}
                            </SelectItem>
                          ))}
                        </SelectGroup>
                      )}
                    </SelectContent>
                  </Select>
                )}
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label={copy.format}>
                  {(p) => (
                    <Select
                      value={effectiveFormat}
                      onValueChange={(v) => setFormat(v as PostFormat)}
                    >
                      <SelectTrigger id={p.id} className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {formats.map((f) => (
                          <SelectItem key={f} value={f}>
                            {postFormatLabels[f]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </Field>
                <Field label={copy.content}>
                  {(p) => (
                    <Select value={contentId} onValueChange={setContentId}>
                      <SelectTrigger id={p.id} className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={NONE}>{copy.contentNone}</SelectItem>
                        {options.contents.map((c) => (
                          <SelectItem key={c.id} value={c.id}>
                            {c.code} · {c.title}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </Field>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label={copy.date}>
                  {(p) => (
                    <Input
                      {...p}
                      type="date"
                      value={date}
                      required
                      onChange={(e) => setDate(e.target.value)}
                    />
                  )}
                </Field>
                <Field label={copy.time}>
                  {(p) => (
                    <Input
                      {...p}
                      type="time"
                      step={300}
                      value={time}
                      required
                      onChange={(e) => setTime(e.target.value)}
                    />
                  )}
                </Field>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={onClose}>
              {common.actions.cancel}
            </Button>
            <Button type="submit" disabled={!hasPublishers || !campaign || pending}>
              {pending && <Loader2 className="animate-spin" aria-hidden />}
              {copy.submit}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
