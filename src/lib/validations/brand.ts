import { z } from "zod";
import { email, hexColor, id, optionalText, optionalUrl, requiredText } from "./common";

export const TIMEZONES = [
  { value: "Europe/Paris", label: "Paris (France)" },
  { value: "Europe/Brussels", label: "Bruxelles (Belgique)" },
  { value: "Europe/Luxembourg", label: "Luxembourg" },
  { value: "Europe/Zurich", label: "Zurich (Suisse)" },
  { value: "Europe/London", label: "Londres (Royaume-Uni)" },
  { value: "America/Montreal", label: "Montréal (Canada)" },
  { value: "Indian/Reunion", label: "La Réunion" },
] as const;

const timezone = z.enum(TIMEZONES.map((t) => t.value) as [string, ...string[]], {
  message: "Choisissez un fuseau horaire.",
});

export const brandCreateSchema = z.object({
  name: requiredText(80, "Donnez un nom à la marque."),
  color: hexColor,
});

export const brandGeneralSchema = z.object({
  brandId: id,
  name: requiredText(80, "Donnez un nom à la marque."),
  color: hexColor,
  logoUrl: optionalUrl,
  timezone,
});

const longText = (max: number) =>
  z.string().trim().max(max, `${max} caractères maximum.`).default("");

/** « #IT for Business » → « ITforBusiness »: no leading #, no spaces (LinkedIn hashtags). */
export function normalizeHashtag(value: string): string {
  return value.trim().replace(/^#+/, "").replace(/\s+/g, "");
}

/** The structured brand prompt (§10.1), edited in Réglages › Prompt. */
export const brandPromptFieldsSchema = z.object({
  editorialLine: longText(3000),
  tone: longText(1500),
  dos: longText(2000),
  donts: longText(2000),
  examplePosts: z
    .array(
      z.object({
        body: z.string().trim().max(3000, "3 000 caractères maximum."),
        note: z.string().trim().max(120, "120 caractères maximum.").optional().default(""),
      }),
    )
    .max(5, "5 exemples maximum.")
    .default([])
    .transform((list) => list.filter((e) => e.body !== "")),
  hashtags: z
    .array(z.string())
    .max(15, "15 hashtags maximum.")
    .default([])
    .transform((list) => [...new Set(list.map(normalizeHashtag).filter(Boolean))])
    .refine((list) => list.every((h) => h.length <= 60), "60 caractères maximum par hashtag."),
  defaultCta: optionalText(200),
  mentionHandle: optionalText(80),
  extraInstructions: optionalText(3000),
});

export const brandPromptSchema = brandPromptFieldsSchema.extend({ brandId: id });

export const socialAccountSchema = z
  .object({
    brandId: id,
    accountId: id.optional(),
    platform: z.enum(["LINKEDIN", "YOUTUBE"]),
    name: requiredText(80, "Donnez un nom au compte, par exemple « IT for Business »."),
    url: optionalUrl,
    kitContributorId: id.nullable().optional(),
  })
  .transform((v) => ({
    ...v,
    // Lot 1: LinkedIn pages are published with a kit, YouTube from Studio (AUTO comes with lot 4).
    publishMode: v.platform === "LINKEDIN" ? ("KIT" as const) : ("STUDIO" as const),
    kitContributorId: v.platform === "LINKEDIN" ? (v.kitContributorId ?? null) : null,
  }));

export const contributorSchema = z.object({
  brandId: id,
  contributorId: id.optional(),
  firstName: requiredText(60, "Indiquez le prénom."),
  lastName: optionalText(60),
  email,
  jobTitle: optionalText(80),
  linkedinUrl: optionalUrl,
});

export const roleSchema = z.enum(["ADMIN", "VALIDATOR", "EDITOR", "CLIENT"]);

export const invitationSchema = z.object({
  brandId: id,
  email,
  role: roleSchema,
  clientCanApprove: z.boolean().default(false),
});

export const membershipUpdateSchema = z.object({
  brandId: id,
  membershipId: id,
  role: roleSchema,
  clientCanApprove: z.boolean().default(false),
});
