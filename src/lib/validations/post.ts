import { z } from "zod";
import { isDateOnly, isTime } from "@/lib/dates";
import { LIMITS, decodePublisher } from "@/lib/posts";
import { id } from "./common";

export const POST_FORMATS = [
  "VIDEO_POST",
  "SHORT",
  "LONG_VIDEO",
  "IMAGE",
  "DOCUMENT",
  "TEXT",
] as const;

const localDate = z.string().refine(isDateOnly, "Choisissez une date valide.");
const localTime = z.string().refine(isTime, "Heure au format 09:00.");
const publisher = z
  .string()
  .refine((v) => decodePublisher(v) !== null, "Choisissez un compte ou un relais.");
const nullableText = (max: number, message: string) =>
  z
    .string()
    .max(max, message)
    .transform((v) => (v.trim() === "" ? null : v))
    .nullable();

export const postCreateSchema = z.object({
  campaignId: id,
  publisher,
  format: z.enum(POST_FORMATS),
  date: localDate,
  time: localTime,
  contentId: id.nullable().optional(),
  angle: z.string().max(2000).optional(),
});

/** Editor autosave: every field optional, only present fields are written. */
export const postUpdateSchema = z.object({
  postId: id,
  publisher: publisher.optional(),
  format: z.enum(POST_FORMATS).optional(),
  date: localDate.optional(),
  time: localTime.optional(),
  contentId: id.nullable().optional(),
  angle: nullableText(2000, "2 000 caractères maximum.").optional(),
  body: nullableText(
    LIMITS.linkedinBody,
    `${LIMITS.linkedinBody} caractères maximum pour LinkedIn.`,
  ).optional(),
  youtubeTitle: nullableText(
    LIMITS.youtubeTitle,
    `${LIMITS.youtubeTitle} caractères maximum.`,
  ).optional(),
  youtubeDescription: nullableText(
    LIMITS.youtubeDescription,
    `${LIMITS.youtubeDescription} caractères maximum.`,
  ).optional(),
  youtubeTags: z.array(z.string().trim().min(1).max(60)).max(30).optional(),
  linkToContentId: id.nullable().optional(),
  linkToUrl: z
    .string()
    .trim()
    .transform((v) => (v === "" ? null : v))
    .nullable()
    .optional()
    .refine(
      (v) => v == null || /^https?:\/\/\S+\.\S+/.test(v),
      "Saisissez une adresse web complète.",
    ),
  relatedVideoAdded: z.boolean().optional(),
  /** Explicit consent to send an approved post back to draft (§6.3). */
  confirmReset: z.boolean().optional(),
  /** Set when the saved text is an AI proposal used as is (bodySource = AI). */
  aiTask: z.enum(["post.write", "post.variant", "post.rewrite", "post.youtube"]).optional(),
});

export const postMoveSchema = z.object({
  postId: id,
  date: localDate,
  time: localTime.optional(),
});

export const postBulkSchema = z.object({
  postIds: z.array(id).min(1).max(500),
});

export const postShiftSchema = postBulkSchema.extend({
  days: z
    .number()
    .int()
    .min(-365)
    .max(365)
    .refine((d) => d !== 0, "Choisissez un décalage."),
});

export const postSetTimeSchema = postBulkSchema.extend({ time: localTime });

export const postRestoreSchema = postBulkSchema;
