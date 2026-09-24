"use client";

import { Loader2, RotateCcw, Sparkles } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import {
  createPlanAction,
  proposePlanningAction,
} from "@/app/(app)/[brandSlug]/campagnes/ai-actions";
import { Button } from "@/components/ui/button";
import { PlatformIcon } from "@/components/brand/platform-icon";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { wizardCopy } from "@/lib/copy/wizard";
import { DAYS, FORMAT_LABELS } from "@/lib/import/normalize";
import type { Platform, PostFormat } from "@/lib/posts";
import { cn } from "@/lib/utils";

const copy = wizardCopy.step3.planner;

type Item = {
  week: number;
  day: number;
  time: string;
  account: string;
  format: PostFormat;
  contentCode: string | null;
  angle: string;
  platform: Platform;
  keep: boolean;
};

/**
 * « Laisser l'IA proposer un planning » (§8.5): a grid of publications to keep or drop and adjust,
 * created through the same checks as an import.
 */
export function AiPlanner({
  getCampaignId,
  onCreated,
}: {
  /** Saves the draft first when needed and returns its id. */
  getCampaignId: () => Promise<string>;
  onCreated: (count: number) => void;
}) {
  const [items, setItems] = useState<Item[] | null>(null);
  const [proposing, startProposing] = useTransition();
  const [creating, startCreating] = useTransition();

  const propose = () =>
    startProposing(async () => {
      let campaignId: string;
      try {
        campaignId = await getCampaignId();
      } catch (e) {
        return void toast.error(e instanceof Error ? e.message : "");
      }
      const result = await proposePlanningAction({ campaignId });
      if (!result.ok) return void toast.error(result.error);
      setItems(result.data.map((p) => ({ ...p, keep: true })));
    });

  const kept = items?.filter((i) => i.keep) ?? [];

  const create = () =>
    startCreating(async () => {
      if (kept.length === 0) return void toast.info(copy.none);
      const campaignId = await getCampaignId();
      const result = await createPlanAction({
        campaignId,
        items: kept.map((item) => ({
          week: item.week,
          day: item.day,
          time: item.time,
          account: item.account,
          format: item.format,
          contentCode: item.contentCode,
          angle: item.angle,
        })),
      });
      if (!result.ok) return void toast.error(result.error);
      toast.success(copy.created(result.data.created));
      setItems(null);
      onCreated(result.data.created);
    });

  const update = (index: number, patch: Partial<Item>) =>
    setItems(
      (list) => list?.map((item, i) => (i === index ? { ...item, ...patch } : item)) ?? null,
    );

  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" size="sm" disabled={proposing || creating} onClick={propose}>
          {proposing ? (
            <Loader2 className="animate-spin" aria-hidden />
          ) : items ? (
            <RotateCcw aria-hidden />
          ) : (
            <Sparkles aria-hidden />
          )}
          {proposing ? copy.proposing : items ? copy.again : copy.propose}
        </Button>
      </div>

      {items && items.length > 0 && (
        <>
          <p className="text-muted-foreground text-sm">{copy.intro(items.length)}</p>
          {/* A list rather than a table: it fits the wizard column and phones. */}
          <ul aria-label={copy.caption} className="divide-y rounded-xl border">
            {items.map((item, i) => {
              const when = copy.when(item.week, DAYS[item.day] ?? "", item.time);
              return (
                <li
                  key={i}
                  className={cn("grid gap-2 px-3 py-2.5", !item.keep && "text-muted-foreground")}
                >
                  <div className="flex items-start gap-3">
                    <Checkbox
                      className="mt-0.5"
                      checked={item.keep}
                      aria-label={copy.keep(when)}
                      onCheckedChange={(v) => update(i, { keep: v === true })}
                    />
                    <div className="grid min-w-0 flex-1 gap-0.5">
                      <span className="tabular text-sm font-medium">{when}</span>
                      <span className="text-muted-foreground flex flex-wrap items-center gap-x-1.5 text-xs">
                        <PlatformIcon platform={item.platform} className="size-3.5" />
                        {item.account}
                        <span aria-hidden>·</span>
                        {FORMAT_LABELS[item.format]}
                        {item.contentCode && (
                          <>
                            <span aria-hidden>·</span>
                            <span className="font-mono">{item.contentCode}</span>
                          </>
                        )}
                      </span>
                    </div>
                  </div>
                  <Input
                    aria-label={copy.angleLabel(when)}
                    className="h-8 sm:ml-7 sm:w-[calc(100%-1.75rem)]"
                    maxLength={500}
                    value={item.angle}
                    disabled={!item.keep}
                    onChange={(e) => update(i, { angle: e.target.value })}
                  />
                </li>
              );
            })}
          </ul>
          <div className="flex justify-end">
            <Button type="button" disabled={creating || kept.length === 0} onClick={create}>
              {creating && <Loader2 className="animate-spin" aria-hidden />}
              {creating ? copy.creating : copy.create(kept.length)}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
