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
