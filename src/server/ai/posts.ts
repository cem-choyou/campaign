import "server-only";
import { z } from "zod";
import { env } from "@/env";
import { LIMITS, isComplete, isLocked, type PostFormat, type PostStatus } from "@/lib/posts";
import { db } from "@/server/db";
import { AppError } from "@/server/errors";
import { type AiTask, generateObject, generateText, streamText } from "./client";
import { loadPostPromptInput } from "./context";
import { mockPost, mockRewrite, mockYoutube } from "./mock";
import {
  QUICK_ACTIONS,
  type QuickAction,
  VARIANT_HOOKS,
  rewritePrompt,
  writePostPrompt,
  youtubeMetaPrompt,
} from "./prompt";
import { consumeAi } from "./quota";

// AI operations on a post (§8.7, §10). Callers check `campaign.edit` first.

export const postTextRequestSchema = z.discriminatedUnion("mode", [
  z.object({ mode: z.literal("write"), postId: z.string().min(1) }),
  z.object({
    mode: z.literal("variant"),
    postId: z.string().min(1),
    variant: z
      .number()
      .int()
      .min(0)
      .max(VARIANT_HOOKS.length - 1),
  }),
  z.object({
    mode: z.literal("rewrite"),
    postId: z.string().min(1),
    current: z
      .string()
      .trim()
      .min(1, "Écrivez ou générez d'abord un texte.")
      .max(LIMITS.linkedinBody),
    action: z.enum(Object.keys(QUICK_ACTIONS) as [QuickAction, ...QuickAction[]]).optional(),
    instruction: z.string().trim().max(500).optional(),
  }),
]);

export type PostTextRequest = z.infer<typeof postTextRequestSchema>;

const TASK: Record<PostTextRequest["mode"], AiTask> = {
  write: "post.write",
  variant: "post.variant",
  rewrite: "post.rewrite",
};

/** Streams a post text (write, one of the 3 variants, or a rewrite). */
export async function streamPostText(
  request: PostTextRequest,
  actor: { userId: string; brandId: string },
  signal?: AbortSignal,
) {
  const { input, post, brand } = await loadPostPromptInput(request.postId, actor.brandId);
  if (isLocked(post.status as PostStatus)) {
    throw new AppError("CONFLICT", "Ce post est publié ou en cours de publication.");
  }
  let prompt;
  let mock: () => string;
  if (request.mode === "rewrite") {
    const instruction = request.action ? QUICK_ACTIONS[request.action] : request.instruction;
    if (!instruction) throw new AppError("INVALID", "Indiquez la modification souhaitée.");
    prompt = rewritePrompt(input, request.current, instruction);
    mock = () => mockRewrite(request.current, instruction);
  } else {
    const variant = request.mode === "variant" ? request.variant : undefined;
    prompt = writePostPrompt(input, variant === undefined ? undefined : VARIANT_HOOKS[variant]);
    mock = () => mockPost(input, variant ?? 0);
  }
  await consumeAi(brand, actor.userId);
  return streamText(prompt, {
    task: TASK[request.mode],
    effort: request.mode === "rewrite" ? "low" : "medium",
    signal,
    mock,
  });
}

export const youtubeMetaSchema = z.object({
  title: z.string(),
  description: z.string(),
  tags: z.array(z.string()),
});

/** Title, description and tags of a YouTube post (structured output). */
export async function suggestYoutubeMeta(
  postId: string,
  actor: { userId: string; brandId: string },
) {
  const { input, brand } = await loadPostPromptInput(postId, actor.brandId);
  if (input.post.platform !== "YOUTUBE") {
    throw new AppError("INVALID", "Ce post n'est pas une vidéo YouTube.");
  }
  await consumeAi(brand, actor.userId);
  const meta = await generateObject(youtubeMetaPrompt(input), youtubeMetaSchema, {
    task: "post.youtube",
    effort: "medium",
    mock: () => mockYoutube(input),
  });
  return {
    title: meta.title.trim().slice(0, LIMITS.youtubeTitle),
    description: meta.description.trim().slice(0, LIMITS.youtubeDescription),
    tags: [...new Set(meta.tags.map((t) => t.replace(/^#/, "").trim()).filter(Boolean))].slice(
      0,
      15,
    ),
  };
}

/** What `Post.aiPromptUsed` keeps: enough to understand where a text came from. */
export function aiPromptRecord(task: AiTask, extra: Record<string, unknown> = {}) {
  return { task, model: env.AI_MODEL, at: new Date().toISOString(), ...extra };
}

/**
 * Bulk writing (§10.3): drafts one empty post and saves it. Skips posts that got a text meanwhile
 * or are locked, so the page can resume a run without overwriting anything.
 */
export async function writeEmptyPost(postId: string, actor: { userId: string; brandId: string }) {
  const { input, post, brand } = await loadPostPromptInput(postId, actor.brandId);
  const current = await db.post.findUniqueOrThrow({
    where: { id: postId },
    select: { status: true, format: true, body: true, youtubeTitle: true },
  });
  if (
    isLocked(current.status as PostStatus) ||
    current.status === "CANCELLED" ||
    isComplete({ ...current, format: current.format as PostFormat })
  ) {
    return { skipped: true as const };
  }

  if (input.post.platform === "YOUTUBE") {
    const meta = await suggestYoutubeMeta(postId, actor);
    await db.$transaction([
      db.post.update({
        where: { id: post.id },
        data: {
          youtubeTitle: meta.title,
          youtubeDescription: meta.description,
          youtubeTags: meta.tags,
          bodySource: "AI",
          aiPromptUsed: aiPromptRecord("post.youtube", { bulk: true }),
        },
      }),
      db.postVersion.create({
        data: { postId, body: meta.description, source: "AI", createdById: actor.userId },
      }),
    ]);
    return { skipped: false as const };
  }

  await consumeAi(brand, actor.userId);
  const text = await generateText(writePostPrompt(input), {
    task: "post.write",
    effort: "medium",
    mock: () => mockPost(input),
  });
  const body = text.slice(0, LIMITS.linkedinBody);
  await db.$transaction([
    db.post.update({
      where: { id: post.id },
      data: { body, bodySource: "AI", aiPromptUsed: aiPromptRecord("post.write", { bulk: true }) },
    }),
    db.postVersion.create({ data: { postId, body, source: "AI", createdById: actor.userId } }),
  ]);
  return { skipped: false as const };
}
