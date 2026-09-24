"use client";

import { Globe, MessageCircle, Play, Repeat2, Send, ThumbsUp } from "lucide-react";
import { useState } from "react";
import { BrandAvatar } from "@/components/brand/brand-avatar";
import { PlatformIcon } from "@/components/brand/platform-icon";
import { editorCopy } from "@/lib/copy/editor";
import { linkedinFold } from "@/lib/posts";
import { youtubeThumbnail } from "@/lib/youtube";
import { cn } from "@/lib/utils";

const copy = editorCopy.preview;

type Media = { title: string; youtubeVideoId: string | null } | null;

export function LinkedInPreview({
  author,
  body,
  media,
  brandColor,
  logoUrl,
}: {
  author: { name: string; subtitle: string; isPage: boolean };
  body: string;
  media: Media;
  brandColor: string;
  logoUrl: string | null;
}) {
  const [expanded, setExpanded] = useState(false);
  const { visible, truncated } = linkedinFold(body);

  return (
    <article
      aria-label={copy.linkedin}
      className="@container rounded-lg border bg-white text-[14px] leading-[1.45] text-[#191919] shadow-[var(--shadow-soft)] dark:bg-[#1b1f23] dark:text-[#e8e8e8]"
    >
      <header className="flex items-start gap-2 p-3">
        {author.isPage ? (
          <BrandAvatar
            name={author.name}
            color={brandColor}
            logoUrl={logoUrl}
            className="size-12 rounded-sm text-sm"
          />
        ) : (
          <span className="flex size-12 items-center justify-center rounded-full bg-[#e9e5df] text-sm font-semibold text-[#56687a]">
            {author.name.slice(0, 1).toUpperCase()}
          </span>
        )}
        <div className="min-w-0">
          <p className="truncate font-semibold">{author.name}</p>
          <p className="truncate text-xs text-[#666] dark:text-[#a0a0a0]">{author.subtitle}</p>
          <p className="flex items-center gap-1 text-xs text-[#666] dark:text-[#a0a0a0]">
            {copy.now} · <Globe className="size-3" aria-hidden />
          </p>
        </div>
      </header>
      <div className="px-3 pb-2 whitespace-pre-wrap">
        {body ? (
          <>
            {expanded || !truncated ? body : visible}
            {truncated && (
              <button
                type="button"
                onClick={() => setExpanded((v) => !v)}
                className="ml-1 font-semibold text-[#666] hover:text-[#0a66c2] hover:underline dark:text-[#a0a0a0]"
              >
                {expanded ? copy.seeLess : copy.seeMore}
              </button>
            )}
          </>
        ) : (
          <span className="text-[#999] italic">{copy.emptyBody}</span>
        )}
      </div>
      {media && (
        <div className="relative aspect-video bg-[#e9e5df] dark:bg-[#2b3035]">
          {media.youtubeVideoId ? (
            // eslint-disable-next-line @next/next/no-img-element -- YouTube thumbnail
            <img
              src={youtubeThumbnail(media.youtubeVideoId)}
              alt=""
              className="size-full object-cover"
            />
          ) : (
            <span className="absolute inset-x-3 bottom-3 truncate text-xs text-[#56687a]">
              {media.title}
            </span>
          )}
          <span className="absolute top-1/2 left-1/2 flex size-12 -translate-1/2 items-center justify-center rounded-full bg-black/60 text-white">
            <Play className="size-5 fill-current" aria-hidden />
          </span>
        </div>
      )}
      <footer className="flex justify-around border-t px-2 py-1 text-xs font-semibold text-[#666] dark:border-white/10 dark:text-[#a0a0a0]">
        {[ThumbsUp, MessageCircle, Repeat2, Send].map((Icon, i) => (
          <span key={i} className="flex items-center gap-1 px-2 py-2">
            <Icon className="size-4" aria-hidden />
            <span className="hidden @[26rem]:inline">{copy.reactions[i]}</span>
          </span>
        ))}
      </footer>
    </article>
  );
}

export function YouTubePreview({
  channel,
  title,
  description,
  isShort,
  media,
}: {
  channel: string;
  title: string;
  description: string;
  isShort: boolean;
  media: Media;
}) {
  return (
    <article
      aria-label={copy.youtube}
      className={cn("grid gap-3", isShort && "justify-items-center")}
    >
      <div
        className={cn(
          "relative overflow-hidden rounded-xl bg-black",
          isShort ? "aspect-[9/16] w-52" : "aspect-video w-full",
        )}
      >
        {media?.youtubeVideoId && (
          // eslint-disable-next-line @next/next/no-img-element -- YouTube thumbnail
          <img
            src={youtubeThumbnail(media.youtubeVideoId)}
            alt=""
            className="size-full object-cover opacity-90"
          />
        )}
        <span className="absolute top-1/2 left-1/2 flex size-12 -translate-1/2 items-center justify-center rounded-full bg-[#ff0000] text-white">
          <Play className="size-5 fill-current" aria-hidden />
        </span>
        {isShort && (
          <span className="absolute top-2 left-2 inline-flex items-center gap-1 rounded bg-black/60 px-1.5 py-0.5 text-[11px] font-semibold text-white">
            <PlatformIcon platform="YOUTUBE" className="size-3" />
            {copy.shortBadge}
          </span>
        )}
      </div>
      <div className={cn("grid gap-1", isShort && "w-52")}>
        <p className={cn("line-clamp-2 font-semibold", !title && "text-muted-foreground italic")}>
          {title || copy.emptyTitle}
        </p>
        <p className="text-muted-foreground text-xs">
          {channel} · {copy.views}
        </p>
        {description && (
          <p className="bg-muted mt-1 line-clamp-4 rounded-lg p-2 text-xs whitespace-pre-wrap">
            {description}
          </p>
        )}
      </div>
    </article>
  );
}
