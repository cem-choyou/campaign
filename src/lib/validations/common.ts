import { z } from "zod";
import { isHexColor, normalizeHex } from "@/lib/color";

export const id = z.string().min(1).max(64);

export const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `${max} caractères maximum.`)
    .transform((v) => (v === "" ? null : v))
    .nullable()
    .optional();

export const requiredText = (max: number, message: string) =>
  z.string().trim().min(1, message).max(max, `${max} caractères maximum.`);

export const email = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(z.email("Saisissez une adresse e-mail valide, par exemple prenom.nom@entreprise.fr."));

export const optionalUrl = z
  .string()
  .trim()
  .transform((v) => (v === "" ? null : v))
  .nullable()
  .optional()
  .refine((v) => v == null || /^https?:\/\/\S+\.\S+/.test(v), {
    message: "Saisissez une adresse web complète, commençant par https://.",
  });

export const hexColor = z
  .string()
  .trim()
  .refine(isHexColor, "Saisissez une couleur au format #1F3A5F.")
  .transform((v) => normalizeHex(v)!);
