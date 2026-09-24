// Tolerant reading of spreadsheet values (§12): case, accents and spaces never matter
// (« ITforBusiness » = « IT for Business »). Pure, shared by the parser and the preview.

import { DEFAULT_TIME } from "@/lib/dates";
import type { PostFormat } from "@/lib/posts";

export type ContentType = "LONG_VIDEO" | "CAPSULE" | "SHORT" | "IMAGE" | "DOCUMENT";

/** Lowercase, no accents, letters and digits only. */
export function normalizeKey(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

export function cleanText(value: unknown): string {
  if (value === null || value === undefined) return "";
  return String(value).replace(/\s+/g, " ").trim();
}

/** Keeps line breaks (post bodies, briefs), trims each end. */
export function cleanMultiline(value: unknown): string {
  if (value === null || value === undefined) return "";
  return String(value)
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .trim();
}

// ---------- Days ----------

export const DAYS = [
  "Lundi",
  "Mardi",
  "Mercredi",
  "Jeudi",
  "Vendredi",
  "Samedi",
  "Dimanche",
] as const;

const DAY_ALIASES: Record<string, number> = {};
DAYS.forEach((d, i) => {
  const key = normalizeKey(d);
  DAY_ALIASES[key] = i;
  DAY_ALIASES[key.slice(0, 3)] = i;
});
["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"].forEach((d, i) => {
  DAY_ALIASES[d] = i;
  DAY_ALIASES[d.slice(0, 3)] = i;
});

/** « Lundi », « lun. », « MERCREDI » → 0..6; null when unknown. */
export function parseDay(value: unknown): number | null {
  const key = normalizeKey(cleanText(value));
  return key ? (DAY_ALIASES[key] ?? null) : null;
}

// ---------- Weeks ----------

/** 1, « 1 », « Semaine 1 », « S1 » → 1; null when there is no positive integer. */
export function parseWeek(value: unknown): number | null {
  if (typeof value === "number") return Number.isInteger(value) && value >= 1 ? value : null;
  const match = /(\d+)/.exec(cleanText(value));
  if (!match) return null;
  const week = Number(match[1]);
  return week >= 1 && week <= 104 ? week : null;
}

// ---------- Times ----------

/**
 * Excel times arrive as a Date on 1899-12-30 (exceljs), a fraction of a day, or text
 * (« 9:00 », « 09h30 », « 9h »). Returns "HH:mm" or null.
 */
export function parseTime(value: unknown): string | null {
  const pad = (n: number) => String(n).padStart(2, "0");
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return `${pad(value.getUTCHours())}:${pad(value.getUTCMinutes())}`;
  }
  if (typeof value === "number" && value >= 0 && value < 1) {
    const minutes = Math.round(value * 24 * 60);
    return `${pad(Math.floor(minutes / 60) % 24)}:${pad(minutes % 60)}`;
  }
  const text = cleanText(value).toLowerCase();
  const match = /^(\d{1,2})\s*[:h]\s*(\d{2})?$/.exec(text);
  if (!match) return null;
  const h = Number(match[1]);
  const m = Number(match[2] ?? 0);
  return h < 24 && m < 60 ? `${pad(h)}:${pad(m)}` : null;
}

export { DEFAULT_TIME };

// ---------- Dates ----------

/** A typed date (Date cell, « 2026-10-05 » or « 05/10/2026 ») → "yyyy-MM-dd", else null. */
export function parseDateCell(value: unknown): string | null {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    // exceljs gives date cells as UTC midnight of the calendar day.
    return value.toISOString().slice(0, 10);
  }
  const text = cleanText(value);
  let m = /^(\d{4})-(\d{2})-(\d{2})/.exec(text);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(text);
  if (m) return `${m[3]}-${m[2]!.padStart(2, "0")}-${m[1]!.padStart(2, "0")}`;
  return null;
}

// ---------- Labels of the template's lists ----------

export const FORMAT_LABELS: Record<PostFormat, string> = {
  VIDEO_POST: "Post vidéo",
  SHORT: "Short",
  LONG_VIDEO: "Vidéo longue",
  IMAGE: "Image",
  DOCUMENT: "Document PDF",
  TEXT: "Texte seul",
};

export const CONTENT_TYPE_LABELS: Record<ContentType, string> = {
  LONG_VIDEO: "Vidéo longue",
  CAPSULE: "Capsule",
  SHORT: "Short",
  IMAGE: "Image",
  DOCUMENT: "Document PDF",
};

function byLabel<T extends string>(labels: Record<T, string>, extra: Record<string, T> = {}) {
  const map = new Map<string, T>();
  for (const [code, label] of Object.entries(labels) as [T, string][]) {
    map.set(normalizeKey(label), code);
    map.set(normalizeKey(code), code);
  }
  for (const [alias, code] of Object.entries(extra)) map.set(normalizeKey(alias), code);
  return (value: unknown): T | null => map.get(normalizeKey(cleanText(value))) ?? null;
}

export const parseFormat = byLabel<PostFormat>(FORMAT_LABELS, {
  Vidéo: "VIDEO_POST",
  Post: "TEXT",
  Texte: "TEXT",
  Document: "DOCUMENT",
  PDF: "DOCUMENT",
  Carrousel: "DOCUMENT",
  Shorts: "SHORT",
});

export const parseContentType = byLabel<ContentType>(CONTENT_TYPE_LABELS, {
  Vidéo: "LONG_VIDEO",
  Shorts: "SHORT",
  Document: "DOCUMENT",
  PDF: "DOCUMENT",
  Visuel: "IMAGE",
});

/** « Relayé par » : « Anne Laure, Paul ; Marie » → ["Anne Laure", "Paul", "Marie"]. */
export function splitNames(value: unknown): string[] {
  return cleanText(value)
    .split(/[,;/\n]| et /)
    .map((n) => n.trim())
    .filter(Boolean);
}

export function isUrl(value: string): boolean {
  return /^https?:\/\/\S+\.\S+/i.test(value.trim());
}

/** Status column: « Publié » (with or without accent / case). */
export function isPublishedStatus(value: unknown): boolean {
  return normalizeKey(cleanText(value)).startsWith("publie");
}
