import "server-only";
import { formatDateOnlyShort, formatDayLong } from "@/lib/dates";
import type { Platform, PostFormat } from "@/lib/posts";
import { youtubeWatchUrl } from "@/lib/youtube";
import { db } from "@/server/db";
import { AppError } from "@/server/errors";
import type {
  BrandPrompt,
  CampaignContext,
  ContentContext,
  ExamplePost,
  PostPromptInput,
} from "./prompt";

// Loads what the prompt needs from the database (§10.1). Kept apart from prompt.ts, which stays pure.

export const brandPromptSelect = {
  id: true,
  name: true,
  timezone: true,
  editorialLine: true,
  tone: true,
  dos: true,
  donts: true,
  examplePosts: true,
  hashtags: true,
  defaultCta: true,
  mentionHandle: true,
  extraInstructions: true,
} as const;

function asExamples(value: unknown): ExamplePost[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((v) =>
    v && typeof v === "object" && typeof (v as ExamplePost).body === "string"
      ? [{ body: (v as ExamplePost).body, note: (v as ExamplePost).note || undefined }]
      : [],
  );
}

export function toBrandPrompt(brand: {
  name: string;
  editorialLine: string;
  tone: string;
  dos: string;
  donts: string;
  examplePosts: unknown;
  hashtags: string[];
  defaultCta: string | null;
  mentionHandle: string | null;
  extraInstructions: string | null;
}): BrandPrompt {
  return {
    name: brand.name,
    editorialLine: brand.editorialLine,
    tone: brand.tone,
    dos: brand.dos,
    donts: brand.donts,
    examplePosts: asExamples(brand.examplePosts),
    hashtags: brand.hashtags,
    defaultCta: brand.defaultCta,
    mentionHandle: brand.mentionHandle,
    extraInstructions: brand.extraInstructions,
  };
}

function period(start: Date | null, end: Date | null): string | null {
  if (!start) return null;
  return end
    ? `du ${formatDateOnlyShort(start)} au ${formatDateOnlyShort(end)}`
    : `à partir du ${formatDateOnlyShort(start)}`;
}

function toContent(c: {
  code: string;
  type: ContentContext["type"];
  title: string;
  summary: string | null;
  durationSec: number | null;
  youtubeVideoId: string | null;
}): ContentContext {
  return {
    code: c.code,
    type: c.type,
    title: c.title,
    summary: c.summary,
    durationSec: c.durationSec,
    youtubeUrl: c.youtubeVideoId ? youtubeWatchUrl(c.youtubeVideoId) : null,
  };
}

const contentSelect = {
  code: true,
  type: true,
  title: true,
  summary: true,
  durationSec: true,
  youtubeVideoId: true,
} as const;

export async function loadCampaignContext(campaignId: string): Promise<CampaignContext> {
  const campaign = await db.campaign.findUniqueOrThrow({
    where: { id: campaignId },
    select: {
      name: true,
      objective: true,
      audience: true,
      brief: true,
      keyMessage: true,
      callToAction: true,
      startDate: true,
      endDate: true,
      mainContentId: true,
    },
  });
  const main = campaign.mainContentId
    ? await db.content.findFirst({
        where: { id: campaign.mainContentId, campaignId, deletedAt: null },
        select: { code: true, title: true, summary: true },
      })
    : null;
  return {
    name: campaign.name,
    objective: campaign.objective,
    audience: campaign.audience,
    brief: campaign.brief,
    keyMessage: campaign.keyMessage,
    callToAction: campaign.callToAction,
    period: period(campaign.startDate, campaign.endDate),
    mainContent: main,
  };
}

/** Full context of one post (brand checked). */
export async function loadPostPromptInput(postId: string, brandId: string) {
  const post = await db.post.findFirst({
    where: { id: postId, deletedAt: null, campaign: { brandId } },
    select: {
      id: true,
      status: true,
      campaignId: true,
      format: true,
      scheduledAt: true,
      angle: true,
      body: true,
      linkToUrl: true,
      content: { select: contentSelect },
      linkToContent: { select: { title: true, youtubeVideoId: true } },
      socialAccount: { select: { name: true, platform: true } },
      authorContributor: {
        select: { firstName: true, jobTitle: true, toneNote: true, samplePosts: true },
      },
      campaign: { select: { brand: { select: brandPromptSelect } } },
    },
  });
  if (!post) throw new AppError("NOT_FOUND");
  const brand = post.campaign.brand;
  const platform: Platform = post.socialAccount?.platform ?? "LINKEDIN";

  const input: PostPromptInput = {
    brand: toBrandPrompt(brand),
    campaign: await loadCampaignContext(post.campaignId),
    content: post.content ? toContent(post.content) : null,
    post: {
      platform,
      format: post.format as PostFormat,
      day: formatDayLong(post.scheduledAt, brand.timezone),
      publisher: post.authorContributor
        ? {
            kind: "contributor",
            person: {
              firstName: post.authorContributor.firstName,
              jobTitle: post.authorContributor.jobTitle,
              toneNote: post.authorContributor.toneNote,
              samplePosts: asExamples(post.authorContributor.samplePosts),
            },
          }
        : { kind: "account", name: post.socialAccount?.name ?? brand.name },
      angle: post.angle,
      linkTo: post.linkToContent
        ? {
            title: post.linkToContent.title,
            url: post.linkToContent.youtubeVideoId
              ? youtubeWatchUrl(post.linkToContent.youtubeVideoId)
              : null,
          }
        : post.linkToUrl
          ? { title: null, url: post.linkToUrl }
          : null,
    },
  };
  return { input, post, brand: { id: brand.id, timezone: brand.timezone } };
}
