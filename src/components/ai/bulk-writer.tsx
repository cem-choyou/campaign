"use client";

import { CheckCircle2, Loader2, Sparkles, Square } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import {
  listPostsToWriteAction,
  writePostAction,
} from "@/app/(app)/[brandSlug]/campagnes/ai-actions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { aiCopy } from "@/lib/copy/ai";

const copy = aiCopy.bulk;
const CONCURRENCY = 3;
const LIMIT_PREFIX = "La limite quotidienne";

type Phase =
  | { kind: "loading" }
  | { kind: "ready"; ids: string[] }
  | { kind: "running"; total: number }
  | { kind: "finished"; written: number; failed: number; reason: "done" | "cancelled" | "limit" };

/**
 * « Rédiger les textes avec l'IA » (§8.5, §10.3): drafts every post without text, 3 at a time,
 * from the page. Each post is saved as soon as it is written, so stopping or closing loses
 * nothing, and running it again only drafts the posts still empty.
 */
export function BulkWriterButton({
  campaignId,
  variant = "outline",
  size = "sm",
  onFinished,
}: {
  campaignId: string;
  variant?: "default" | "outline" | "ghost";
  size?: "sm" | "default" | "lg";
  onFinished?: () => void;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [phase, setPhase] = useState<Phase>({ kind: "loading" });
  const [progress, setProgress] = useState({ written: 0, failed: 0 });
  const cancelled = useRef(false);
  const [cancelling, setCancelling] = useState(false);
  /**
   * The page is refreshed when the dialog closes, not when the run ends: the refresh can remove
   * this button (no empty post left), and the dialog with it, before the result is read.
   */
  const needsRefresh = useRef(false);
  const isOpen = useRef(false);

  const show = () => {
    isOpen.current = true;
    setOpen(true);
  };

  const close = () => {
    isOpen.current = false;
    setOpen(false);
    if (needsRefresh.current && phase.kind !== "running") {
      needsRefresh.current = false;
      router.refresh();
      onFinished?.();
    }
  };

  const load = async () => {
    setPhase({ kind: "loading" });
    const result = await listPostsToWriteAction({ campaignId });
    setPhase(result.ok ? { kind: "ready", ids: result.data } : { kind: "ready", ids: [] });
  };

  const run = async (ids: string[]) => {
    cancelled.current = false;
    setCancelling(false);
    setProgress({ written: 0, failed: 0 });
    setPhase({ kind: "running", total: ids.length });
    const queue = [...ids];
    let written = 0;
    let failed = 0;
    let limit = false;

    const worker = async () => {
      while (queue.length && !cancelled.current && !limit) {
        const postId = queue.shift()!;
        const result = await writePostAction({ postId });
        if (result.ok) {
          if (!result.data.skipped) written++;
        } else if (result.error.startsWith(LIMIT_PREFIX)) {
          limit = true;
        } else {
          failed++;
        }
        setProgress({ written, failed });
      }
    };
    await Promise.all(Array.from({ length: Math.min(CONCURRENCY, ids.length) }, worker));

    setPhase({
      kind: "finished",
      written,
      failed,
      reason: limit ? "limit" : cancelled.current ? "cancelled" : "done",
    });
    if (isOpen.current) {
      needsRefresh.current = true;
    } else {
      router.refresh();
      onFinished?.();
    }
  };

  const running = phase.kind === "running";

  return (
    <>
      <Button
        type="button"
        variant={variant}
        size={size}
        onClick={() => {
          show();
          if (!running) void load();
        }}
      >
        <Sparkles aria-hidden />
        {copy.open}
      </Button>
      <Dialog
        open={open}
        onOpenChange={(next) => {
          // Closing never stops a run: the texts keep being written and saved.
          if (next) show();
          else close();
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{copy.title}</DialogTitle>
            <DialogDescription>{copy.description}</DialogDescription>
          </DialogHeader>

          <div className="grid gap-3 py-2" aria-live="polite">
            {phase.kind === "loading" && (
              <p className="text-muted-foreground flex items-center gap-2 text-sm">
                <Loader2 className="size-4 animate-spin" aria-hidden />
                {copy.loading}
              </p>
            )}
            {phase.kind === "ready" && (
              <p className="text-sm">
                {phase.ids.length === 0 ? copy.none : copy.count(phase.ids.length)}
              </p>
            )}
            {phase.kind === "running" && (
              <>
                <div className="flex items-center justify-between gap-2 text-sm">
                  <span className="text-muted-foreground">
                    {cancelling ? copy.cancelling : copy.running}
                  </span>
                  <span className="tabular font-medium">
                    {copy.progress(progress.written + progress.failed, phase.total)}
                  </span>
                </div>
                <Progress
                  value={((progress.written + progress.failed) / phase.total) * 100}
                  aria-label={copy.progress(progress.written + progress.failed, phase.total)}
                />
              </>
            )}
            {phase.kind === "finished" && (
              <div className="grid gap-1.5 text-sm">
                <p className="flex items-center gap-2 font-medium">
                  <CheckCircle2 className="text-status-published size-4" aria-hidden />
                  {phase.reason === "done" ? copy.done(phase.written) : copy.stopped(phase.written)}
                </p>
                {phase.reason === "limit" && <p className="text-status-review">{copy.limit}</p>}
                {phase.failed > 0 && (
                  <p className="text-destructive">{copy.failures(phase.failed)}</p>
                )}
              </div>
            )}
          </div>

          <DialogFooter>
            {running ? (
              <Button
                type="button"
                variant="outline"
                disabled={cancelling}
                onClick={() => {
                  cancelled.current = true;
                  setCancelling(true);
                }}
              >
                <Square aria-hidden />
                {copy.cancel}
              </Button>
            ) : (
              <Button type="button" variant="ghost" onClick={close}>
                {copy.close}
              </Button>
            )}
            {phase.kind === "ready" && phase.ids.length > 0 && (
              <Button type="button" onClick={() => void run(phase.ids)}>
                <Sparkles aria-hidden />
                {copy.start(phase.ids.length)}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
