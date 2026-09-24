import "server-only";
import { z } from "zod";
import { formatDayLong } from "@/lib/dates";
import { brandPromptFieldsSchema } from "@/lib/validations/brand";
import { db } from "@/server/db";
import { streamText } from "./client";
import { mockPost } from "./mock";
import { type PostPromptInput, writePostPrompt } from "./prompt";
import { consumeAi } from "./quota";

// « Tester » in Réglages › Prompt (§10.3): writes a trial LinkedIn post with the prompt as it is on
// screen, saved or not, so the admin sees the effect of an edit immediately.

export const sandboxRequestSchema = z.object({
  brandId: z.string().min(1),
  prompt: brandPromptFieldsSchema,
  format: z.enum(["VIDEO_POST", "IMAGE", "DOCUMENT", "TEXT"]),
  angle: z
    .string()
    .trim()
    .min(3, "Indiquez le sujet du post d'essai.")
    .max(500, "500 caractères maximum."),
});

export type SandboxRequest = z.infer<typeof sandboxRequestSchema>;

export async function streamSandboxPost(
  request: SandboxRequest,
  actor: { userId: string },
  signal?: AbortSignal,
) {
  const brand = await db.brand.findUniqueOrThrow({
    where: { id: request.brandId },
    select: {
      id: true,
      name: true,
      timezone: true,
      accounts: {
        where: { platform: "LINKEDIN", isActive: true },
        select: { name: true },
        take: 1,
      },
    },
  });
  const p = request.prompt;
  const input: PostPromptInput = {
    brand: {
      name: brand.name,
      editorialLine: p.editorialLine,
      tone: p.tone,
      dos: p.dos,
      donts: p.donts,
      examplePosts: p.examplePosts,
      hashtags: p.hashtags,
      defaultCta: p.defaultCta ?? null,
      mentionHandle: p.mentionHandle ?? null,
      extraInstructions: p.extraInstructions ?? null,
    },
    campaign: {
      name: "Post d'essai",
      objective: null,
      audience: null,
      brief: null,
      keyMessage: null,
      callToAction: null,
      period: null,
      mainContent: null,
    },
    content: null,
    post: {
      platform: "LINKEDIN",
      format: request.format,
      day: formatDayLong(new Date(), brand.timezone),
      publisher: { kind: "account", name: brand.accounts[0]?.name ?? brand.name },
      angle: request.angle,
      linkTo: null,
    },
  };
  await consumeAi(brand, actor.userId);
  return streamText(writePostPrompt(input), {
    task: "brand.sandbox",
    effort: "medium",
    signal,
    mock: () => mockPost(input),
  });
}
