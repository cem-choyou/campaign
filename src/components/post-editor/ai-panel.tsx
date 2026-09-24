"use client";

import { Check, History, Loader2, RotateCcw, Send, Sparkles, Square } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import {
  listPostVersionsAction,
  suggestYoutubeMetaAction,
} from "@/app/(app)/[brandSlug]/campagnes/post-actions";
import { type StreamStatus, useTextStream } from "@/components/ai/use-text-stream";
import { PlatformIcon } from "@/components/brand/platform-icon";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { editorCopy } from "@/lib/copy/editor";
import { formatDayTime } from "@/lib/dates";
import { cn } from "@/lib/utils";
import type { PostVersionItem } from "@/server/posts";

const copy = editorCopy.ai;
const QUICK = ["shorter", "punchier", "addCta", "newHook", "lessFormal"] as const;
const ROUTE = "/api/ai/post";

export type AiTask = "post.write" | "post.variant" | "post.rewrite" | "post.youtube";
type RetouchPayload = { action?: (typeof QUICK)[number]; instruction?: string };
export type YoutubeMeta = { title: string; description: string; tags: string[] };

type Common = {
  postId: string;
  timezone: string;
  /** Saves pending edits first, so the AI reads the current angle, content and date. */
  flush: () => Promise<void>;
};

// ---------- LinkedIn text ----------

export function AiTextPanel({
  postId,
  timezone,
  flush,
  body,
  onUse,
  onRestore,
}: Common & {
  body: string;
  onUse: (text: string, task: AiTask) => void;
  onRestore: (text: string) => void;
}) {
  const variants = [useTextStream(), useTextStream(), useTextStream()];
  const rewrite = useTextStream();
  const [ask, setAsk] = useState("");
  const [shown, setShown] = useState(false);
  const [lastRetouch, setLastRetouch] = useState<RetouchPayload>({});

  const streaming = [...variants, rewrite].some((s) => s.status === "streaming");

  const generate = async () => {
    await flush();
    rewrite.reset();
    setShown(true);
    variants.forEach((s, variant) => void s.start(ROUTE, { mode: "variant", postId, variant }));
  };

  const retouch = async (payload: RetouchPayload) => {
    if (!body.trim()) return void toast.info(copy.needText);
    setLastRetouch(payload);
    await flush();
    void rewrite.start(ROUTE, { mode: "rewrite", postId, current: body, ...payload });
  };

  const stopAll = () => [...variants, rewrite].forEach((s) => s.stop());

  return (
    <section
      aria-labelledby="ai-panel-title"
      className="@container border-brand/25 bg-brand/[0.04] grid gap-3 rounded-xl border p-3"
    >
      <div className="flex flex-wrap items-center gap-2">
        <h3 id="ai-panel-title" className="flex items-center gap-1.5 text-sm font-semibold">
          <Sparkles className="text-brand size-4" aria-hidden />
          {copy.title}
        </h3>
        <div className="ml-auto flex items-center gap-1">
          <VersionHistory
            postId={postId}
            timezone={timezone}
            current={body}
            onRestore={onRestore}
          />
        </div>
      </div>
      <p className="text-muted-foreground -mt-1 text-xs">{copy.hint}</p>

      <div className="flex flex-wrap items-center gap-2">
        {streaming ? (
          <Button type="button" variant="outline" size="sm" onClick={stopAll}>
            <Square aria-hidden />
            {copy.stop}
          </Button>
        ) : (
          <Button type="button" size="sm" onClick={() => void generate()}>
            <Sparkles aria-hidden />
            {shown ? copy.regenerate : copy.generate}
          </Button>
        )}
      </div>

      <div className="grid gap-2">
        <span className="text-muted-foreground text-xs font-medium">{copy.quickActions}</span>
        <div className="flex flex-wrap gap-1.5">
          {QUICK.map((action) => (
            <Button
              key={action}
              type="button"
              variant="outline"
              size="sm"
              className="h-7 rounded-full px-2.5 text-xs"
              disabled={streaming}
              onClick={() => void retouch({ action })}
            >
              {copy.quick[action]}
            </Button>
          ))}
        </div>
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (ask.trim()) void retouch({ instruction: ask.trim() });
          }}
        >
          <Input
            aria-label={copy.askLabel}
            placeholder={copy.askPlaceholder}
            value={ask}
            maxLength={500}
            onChange={(e) => setAsk(e.target.value)}
            className="h-8"
          />
          <Button
            type="submit"
            variant="outline"
            size="sm"
            disabled={streaming || !ask.trim()}
            aria-label={copy.ask}
          >
            <Send aria-hidden />
            <span className="sr-only @[30rem]:not-sr-only">{copy.ask}</span>
          </Button>
        </form>
      </div>

      {rewrite.status !== "idle" && (
        <ProposalCard
          title={copy.rewriteTitle}
          stream={rewrite}
          actions={
            <>
              <Button
                type="button"
                size="sm"
                disabled={rewrite.status !== "done"}
                onClick={() => {
                  onUse(rewrite.text, "post.rewrite");
                  rewrite.reset();
                }}
              >
                <Check aria-hidden />
                {copy.replace}
              </Button>
              <Button type="button" size="sm" variant="ghost" onClick={rewrite.reset}>
                {copy.dismiss}
              </Button>
            </>
          }
          onRetry={() => void retouch(lastRetouch)}
        />
      )}

      {shown && (
        <div className="grid gap-2 @[34rem]:grid-cols-3">
          {variants.map((s, i) => (
            <ProposalCard
              key={i}
              title={copy.proposal(i + 1)}
              stream={s}
              compact
              onRetry={() => void s.start(ROUTE, { mode: "variant", postId, variant: i })}
              actions={
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={s.status !== "done"}
                  onClick={() => onUse(s.text, "post.variant")}
                >
                  <Check aria-hidden />
                  {copy.use}
                </Button>
              }
            />
          ))}
        </div>
      )}
    </section>
  );
}

function ProposalCard({
  title,
  stream,
  actions,
  onRetry,
  compact,
}: {
  title: string;
  stream: { text: string; status: StreamStatus; error: string | null };
  actions: React.ReactNode;
  onRetry: () => void;
  compact?: boolean;
}) {
  return (
    <article
      aria-label={title}
      aria-busy={stream.status === "streaming"}
      className="bg-background grid content-start gap-2 rounded-lg border p-3"
    >
      <div className="flex items-center gap-2">
        <span className="text-xs font-semibold">{title}</span>
        {stream.status === "streaming" && (
          <span className="text-muted-foreground inline-flex items-center gap-1 text-xs">
            <Loader2 className="size-3 animate-spin" aria-hidden />
            {copy.writing}
          </span>
        )}
      </div>
      {stream.status === "error" ? (
        <div className="grid gap-2">
          <p role="alert" className="text-destructive text-sm">
            {stream.error}
          </p>
          <Button type="button" size="sm" variant="outline" className="w-fit" onClick={onRetry}>
            <RotateCcw aria-hidden />
            {copy.retry}
          </Button>
        </div>
      ) : (
        <p
          // Scrollable: focusable so the whole text can be read with the keyboard.
          tabIndex={0}
          className={cn(
            "focus-visible:ring-ring overflow-y-auto rounded-sm text-sm leading-relaxed whitespace-pre-wrap outline-none focus-visible:ring-2",
            compact ? "max-h-64" : "max-h-80",
          )}
        >
          {stream.text}
          {stream.status === "streaming" && (
            <span className="bg-brand ml-0.5 inline-block h-4 w-1.5 animate-pulse align-text-bottom" />
          )}
        </p>
      )}
      {stream.status !== "error" && <div className="flex flex-wrap gap-2">{actions}</div>}
    </article>
  );
}

// ---------- History ----------

function VersionHistory({
  postId,
  timezone,
  current,
  onRestore,
}: {
  postId: string;
  timezone: string;
  current: string;
  onRestore: (text: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [versions, setVersions] = useState<PostVersionItem[] | null>(null);
  const [loading, startLoading] = useTransition();

  const load = () =>
    startLoading(async () => {
      const result = await listPostVersionsAction({ postId });
      if (!result.ok) return void toast.error(result.error);
      setVersions(result.data);
    });

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) load();
      }}
    >
      <PopoverTrigger asChild>
        <Button type="button" variant="ghost" size="sm">
          <History aria-hidden />
          {copy.history}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-96 max-w-[calc(100vw-2rem)] p-0">
        <p className="border-b px-3 py-2 text-sm font-semibold">{copy.historyTitle}</p>
        <div className="max-h-96 overflow-y-auto" aria-busy={loading}>
          {versions === null ? (
            <p className="text-muted-foreground p-3 text-sm">{copy.historyLoading}</p>
          ) : versions.length === 0 ? (
            <p className="text-muted-foreground p-3 text-sm">{copy.historyEmpty}</p>
          ) : (
            <ol className="divide-y">
              {versions.map((v) => {
                const isCurrent = v.body === current;
                return (
                  <li key={v.id} className="grid gap-1.5 px-3 py-2.5">
                    <p className="text-muted-foreground text-xs">
                      <span className="text-foreground font-medium">{copy.source[v.source]}</span>
                      {" · "}
                      {formatDayTime(new Date(v.createdAt), timezone)}
                      {v.author ? ` · ${v.author}` : ""}
                    </p>
                    <p className="line-clamp-3 text-sm whitespace-pre-wrap">{v.body}</p>
                    {isCurrent ? (
                      <span className="text-muted-foreground text-xs">{copy.current}</span>
                    ) : (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="w-fit"
                        onClick={() => {
                          onRestore(v.body);
                          setOpen(false);
                        }}
                      >
                        <RotateCcw aria-hidden />
                        {copy.restore}
                      </Button>
                    )}
                  </li>
                );
              })}
            </ol>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

// ---------- YouTube metadata ----------

export function AiYoutubePanel({
  postId,
  flush,
  onUse,
}: Omit<Common, "timezone"> & { onUse: (meta: YoutubeMeta) => void }) {
  const [meta, setMeta] = useState<YoutubeMeta | null>(null);
  const [busy, start] = useTransition();

  const suggest = () =>
    start(async () => {
      await flush();
      const result = await suggestYoutubeMetaAction({ postId });
      if (!result.ok) return void toast.error(result.error);
      setMeta(result.data);
    });

  return (
    <section
      aria-labelledby="ai-yt-title"
      className="border-brand/25 bg-brand/[0.04] grid gap-3 rounded-xl border p-3"
    >
      <h3 id="ai-yt-title" className="flex items-center gap-1.5 text-sm font-semibold">
        <Sparkles className="text-brand size-4" aria-hidden />
        {copy.title}
      </h3>
      <p className="text-muted-foreground -mt-1 text-xs">{copy.hint}</p>
      <Button type="button" size="sm" className="w-fit" disabled={busy} onClick={suggest}>
        {busy ? (
          <Loader2 className="animate-spin" aria-hidden />
        ) : (
          <PlatformIcon platform="YOUTUBE" />
        )}
        {busy ? copy.writing : copy.youtube}
      </Button>
      {meta && (
        <article
          aria-label={copy.youtubeTitle}
          className="bg-background grid gap-2 rounded-lg border p-3"
        >
          <p className="font-semibold">{meta.title}</p>
          <p className="text-muted-foreground text-sm whitespace-pre-wrap">{meta.description}</p>
          {meta.tags.length > 0 && (
            <p className="text-muted-foreground text-xs">{meta.tags.join(", ")}</p>
          )}
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              onClick={() => {
                onUse(meta);
                setMeta(null);
              }}
            >
              <Check aria-hidden />
              {copy.youtubeUse}
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => setMeta(null)}>
              {copy.dismiss}
            </Button>
          </div>
        </article>
      )}
    </section>
  );
}
