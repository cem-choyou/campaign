import { z } from "zod";
import { extractYoutubeId } from "@/lib/youtube";
import { id, optionalText, optionalUrl, requiredText } from "./common";

export const CONTENT_TYPES = ["LONG_VIDEO", "CAPSULE", "SHORT", "IMAGE", "DOCUMENT"] as const;

export const contentCode = z
  .string()
  .trim()
  .toUpperCase()
  .min(1, "Donnez un code court, par exemple CAP1.")
  .max(20, "20 caractères maximum.")
  .regex(/^[A-Z0-9][A-Z0-9_-]*$/, "Lettres, chiffres et tirets uniquement, par exemple VID-LONG.");

/** Duration typed as "1:30", "90" (seconds) or "2 min". */
export function parseDuration(input: string): number | null {
  const value = input.trim().toLowerCase();
  if (!value) return null;
  const clock = /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/.exec(value);
  if (clock) {
    const [, a, b, c] = clock;
    return c ? Number(a) * 3600 + Number(b) * 60 + Number(c) : Number(a) * 60 + Number(b);
  }
  const minutes = /^(\d+(?:[.,]\d+)?)\s*min/.exec(value);
  if (minutes) return Math.round(Number(minutes[1]!.replace(",", ".")) * 60);
  const seconds = /^(\d+)\s*s?$/.exec(value);
  return seconds ? Number(seconds[1]) : Number.NaN;
}

export function formatDuration(seconds: number | null | undefined): string {
  if (seconds == null) return "";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export const contentSchema = z
  .object({
    campaignId: id,
    contentId: id.optional(),
    code: contentCode,
    type: z.enum(CONTENT_TYPES),
    title: requiredText(160, "Donnez un titre au contenu."),
    mediaUrl: optionalUrl,
    duration: z.string().trim().max(12).optional().default(""),
    summary: optionalText(4000),
    youtubeUrl: z.string().trim().max(300).optional().default(""),
    parentId: id.nullable().optional(),
  })
  .transform((v, ctx) => {
    const durationSec = parseDuration(v.duration);
    if (Number.isNaN(durationSec)) {
      ctx.addIssue({
        code: "custom",
        path: ["duration"],
        message: "Durée au format 1:30 ou 90 s.",
      });
    }
    const youtubeVideoId = v.youtubeUrl ? extractYoutubeId(v.youtubeUrl) : null;
    if (v.youtubeUrl && !youtubeVideoId) {
      ctx.addIssue({
        code: "custom",
        path: ["youtubeUrl"],
        message: "Ce lien YouTube n'est pas reconnu. Collez l'adresse de la vidéo.",
      });
    }
    return {
      campaignId: v.campaignId,
      contentId: v.contentId,
      code: v.code,
      type: v.type,
      title: v.title,
      mediaUrl: v.mediaUrl ?? null,
      durationSec: Number.isNaN(durationSec) ? null : durationSec,
      summary: v.summary ?? null,
      youtubeVideoId,
      parentId: v.type === "SHORT" ? (v.parentId ?? null) : null,
    };
  });

export const contentDeleteSchema = z.object({ contentId: id, restore: z.boolean().default(false) });
