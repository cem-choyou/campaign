// Shapes of an Excel import (§8.8, §12), shared by the server and the preview UI.

import type { Platform, PostFormat } from "@/lib/posts";
import type { ContentType } from "./normalize";

export type SheetName = "Fichier" | "Campagne" | "Contenus" | "Planning" | "Relais";

// ---------- What the file says (parse step, no database) ----------

export type ParsedCampaign = {
  brand: string;
  name: string;
  /** Monday of week 1, "yyyy-MM-dd". */
  startDate: string | null;
  objective: string;
  audience: string;
  brief: string;
  mainContentCode: string;
};

export type ParsedContent = {
  row: number;
  code: string;
  type: ContentType | null;
  typeLabel: string;
  title: string;
  mediaUrl: string;
  durationSec: number | null;
  summary: string;
  youtubeUrl: string;
};

export type ParsedContributor = {
  row: number;
  firstName: string;
  lastName: string;
  email: string;
  jobTitle: string;
  linkedinUrl: string;
  toneNote: string;
};

export type ParsedRow = {
  row: number;
  week: number | null;
  weekLabel: string;
  dayOffset: number | null;
  dayLabel: string;
  /** A date typed over the formula: it wins over week + day (§12). */
  date: string | null;
  time: string | null;
  timeLabel: string;
  account: string;
  format: PostFormat | null;
  formatLabel: string;
  contentCode: string;
  linkTo: string;
  angle: string;
  body: string;
  relayNames: string[];
  /** Status column says « Publié » (with or without a link). */
  statusPublished: boolean;
  /** « Publié » and a valid link: imported as history (PUBLISHED). */
  published: boolean;
  publishedUrl: string;
};

export type ParsedWorkbook = {
  kind: "template" | "free";
  campaign: ParsedCampaign;
  contents: ParsedContent[];
  contributors: ParsedContributor[];
  rows: ParsedRow[];
  /** File-level problems (missing sheet, empty planning…). */
  fileIssues: string[];
};

// ---------- Corrections typed in the preview ----------

export type RowOverride = {
  /** "account:<id>" | "contributor:<id>" */
  publisher?: string;
  contentCode?: string | null;
  format?: PostFormat;
  date?: string;
  time?: string;
  skip?: boolean;
};

export type Overrides = Record<number, RowOverride>;

// ---------- Preview (after matching with the brand) ----------

export type Issue = { level: "error" | "warning"; field?: string; message: string };

export type PreviewPublisher =
  | { kind: "account"; id: string; name: string; platform: Platform }
  /** `id` null: a contributor from the Relais sheet, created by the import (`key` = e-mail). */
  | { kind: "contributor"; id: string | null; key?: string; name: string; platform: "LINKEDIN" };

export type PreviewPost = {
  row: number;
  skip: boolean;
  /** Local wall-clock date and time in the brand time zone. */
  date: string | null;
  time: string;
  scheduledAt: string | null;
  publisher: PreviewPublisher | null;
  accountLabel: string;
  format: PostFormat | null;
  contentCode: string | null;
  contentTitle: string | null;
  linkToCode: string | null;
  linkToUrl: string | null;
  angle: string;
  body: string;
  relays: { name: string; contributorId: string | null; key?: string }[];
  published: boolean;
  publishedUrl: string | null;
  issues: Issue[];
};

export type PreviewContent = {
  code: string;
  type: ContentType;
  title: string;
  mediaUrl: string | null;
  durationSec: number | null;
  summary: string | null;
  youtubeUrl: string | null;
  /** Already in the target campaign (updated, not created). */
  existing: boolean;
};

export type PreviewContributor = {
  key: string;
  name: string;
  firstName: string;
  lastName: string | null;
  email: string | null;
  jobTitle: string | null;
  linkedinUrl: string | null;
  toneNote: string | null;
  existingId: string | null;
};

export type ImportPreview = {
  campaign: {
    name: string;
    startDate: string | null;
    objective: string | null;
    audience: string | null;
    brief: string | null;
    mainContentCode: string | null;
  };
  contents: PreviewContent[];
  /** Contributors the import will create (named in the planning, unknown to the brand). */
  newContributors: PreviewContributor[];
  posts: PreviewPost[];
  issues: Issue[];
  counts: {
    posts: number;
    skipped: number;
    errors: number;
    warnings: number;
    missions: number;
    withText: number;
    published: number;
  };
};

/** Options offered by the preview's correction menus. */
export type PreviewChoices = {
  accounts: { value: string; label: string; platform: Platform }[];
  contentCodes: { code: string; title: string }[];
};
