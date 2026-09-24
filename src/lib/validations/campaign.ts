import { z } from "zod";
import { isDateOnly } from "@/lib/dates";
import { id, optionalText } from "./common";

export const CAMPAIGN_NAME_MAX = 120;

export const campaignName = z
  .string()
  .trim()
  .min(1, "Donnez un nom à la campagne.")
  .max(CAMPAIGN_NAME_MAX, `${CAMPAIGN_NAME_MAX} caractères maximum.`);

const dateOnly = z
  .string()
  .trim()
  .transform((v) => (v === "" ? null : v))
  .nullable()
  .optional()
  .refine((v) => v == null || isDateOnly(v), "Choisissez une date valide.");

/** Autosaved wizard fields. Everything is optional except the name (§8.5). */
export const campaignDraftSchema = z
  .object({
    campaignId: id,
    name: campaignName.optional(),
    objective: optionalText(500),
    audience: optionalText(2000),
    brief: optionalText(8000),
    keyMessage: optionalText(2000),
    callToAction: optionalText(300),
    startDate: dateOnly,
    endDate: dateOnly,
    mainContentId: id.nullable().optional(),
    wizardStep: z.number().int().min(1).max(5).optional(),
  })
  .refine((v) => !v.startDate || !v.endDate || v.endDate >= v.startDate, {
    path: ["endDate"],
    message: "La date de fin doit être après la date de début.",
  });

export const campaignCreateSchema = z.object({
  brandId: id,
  name: campaignName,
  objective: optionalText(500),
  startDate: dateOnly,
});

export const campaignRenameSchema = z.object({ campaignId: id, name: campaignName });

export const campaignDuplicateSchema = z.object({
  campaignId: id,
  /** New Monday of week 1; posts are shifted by the same number of days. */
  startDate: dateOnly,
});

export const campaignIdSchema = z.object({ campaignId: id });

export const campaignArchiveSchema = z.object({ campaignId: id, archived: z.boolean() });
