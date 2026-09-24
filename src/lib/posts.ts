// Pure post rules shared by the server, the editor and the calendar (CLAUDE.md §6.3, §8.7).

export type PostStatus =
  "DRAFT" | "IN_REVIEW" | "APPROVED" | "PROCESSING" | "PUBLISHED" | "FAILED" | "CANCELLED";
export type PostFormat = "VIDEO_POST" | "SHORT" | "LONG_VIDEO" | "IMAGE" | "DOCUMENT" | "TEXT";
export type Platform = "LINKEDIN" | "YOUTUBE";
export type PublishMode = "AUTO" | "STUDIO" | "KIT";

export const LIMITS = {
  linkedinBody: 3000,
  youtubeTitle: 100,
  youtubeDescription: 5000,
  /** Characters visible before « …voir plus » on desktop (to confirm visually, §8.7). */
  linkedinFold: 210,
  /** Soft warning threshold (share of the limit). */
  warnRatio: 0.9,
} as const;

export const MAX_ATTEMPTS = 3;
export const LOCK_TTL_MS = 10 * 60 * 1000;

export const FORMATS_BY_PLATFORM: Record<Platform, PostFormat[]> = {
  LINKEDIN: ["VIDEO_POST", "IMAGE", "DOCUMENT", "TEXT"],
  YOUTUBE: ["SHORT", "LONG_VIDEO"],
};

export function isFormatAllowed(platform: Platform, format: PostFormat): boolean {
  return FORMATS_BY_PLATFORM[platform].includes(format);
}

/** Locked statuses cannot be edited at all (§6.3). */
export function isLocked(status: PostStatus): boolean {
  return status === "PROCESSING" || status === "PUBLISHED";
}

// ---------- Publisher: a brand account or a contributor (exactly one) ----------

export type Publisher = { kind: "account"; id: string } | { kind: "contributor"; id: string };

export function encodePublisher(p: Publisher): string {
  return `${p.kind}:${p.id}`;
}

export function decodePublisher(value: string): Publisher | null {
  const [kind, id] = value.split(":");
  if (!id || (kind !== "account" && kind !== "contributor")) return null;
  return { kind, id };
}

export function publisherOf(post: {
  socialAccountId: string | null;
  authorContributorId: string | null;
}): Publisher | null {
  if (post.socialAccountId && !post.authorContributorId) {
    return { kind: "account", id: post.socialAccountId };
  }
  if (post.authorContributorId && !post.socialAccountId) {
    return { kind: "contributor", id: post.authorContributorId };
  }
  return null;
}

// ---------- Editing an approved post ----------

/** Fields whose change means « le texte ou le média » changed: an approved post goes back to draft. */
export const APPROVAL_SENSITIVE_FIELDS = [
  "body",
  "contentId",
  "format",
  "publisher",
  "youtubeTitle",
  "youtubeDescription",
  "youtubeTags",
  "linkToContentId",
  "linkToUrl",
] as const;

export function touchesApprovedContent(patch: Record<string, unknown>): boolean {
  return APPROVAL_SENSITIVE_FIELDS.some((field) => patch[field] !== undefined);
}

// ---------- Scheduling ----------

export type ScheduleCheck = { ok: true; warning?: "SOON" } | { ok: false; reason: "PAST" };

/** A post cannot be moved to the past; less than 1 h ahead triggers a warning (§6.3). */
export function checkSchedule(target: Date, now = new Date()): ScheduleCheck {
  const diff = target.getTime() - now.getTime();
  if (diff <= 0) return { ok: false, reason: "PAST" };
  if (diff < 60 * 60 * 1000) return { ok: true, warning: "SOON" };
  return { ok: true };
}

// ---------- State machine (§6.3) ----------

export type PostAction =
  | "submit"
  | "approve"
  | "reject"
  | "cancel"
  | "edit" // text or media changed
  | "claim" // n8n takes an AUTO post
  | "publish_success"
  | "publish_failure"
  | "retry"
  | "studio_published" // YouTube video detected online
  | "kit_confirmed"; // contributor clicked « C'est publié »

export type TransitionContext = {
  mode: PublishMode | null;
  campaignActive: boolean;
  attempts: number;
};

export type TransitionResult =
  { ok: true; status: PostStatus; attempts?: number } | { ok: false; reason: string };

const deny = (reason: string): TransitionResult => ({ ok: false, reason });

export function transition(
  status: PostStatus,
  action: PostAction,
  ctx: TransitionContext,
): TransitionResult {
  switch (action) {
    case "submit":
      return status === "DRAFT"
        ? { ok: true, status: "IN_REVIEW" }
        : deny("Seul un brouillon peut être soumis.");
    case "approve":
      return status === "IN_REVIEW"
        ? { ok: true, status: "APPROVED" }
        : deny("Seul un post en revue peut être validé.");
    case "reject":
      return status === "IN_REVIEW"
        ? { ok: true, status: "DRAFT" }
        : deny("Seul un post en revue peut être refusé.");
    case "cancel":
      return status === "PUBLISHED" || status === "CANCELLED"
        ? deny("Un post publié ne peut pas être annulé.")
        : { ok: true, status: "CANCELLED" };
    case "edit":
      if (isLocked(status)) return deny("Ce post est en cours de publication ou déjà publié.");
      return { ok: true, status: status === "APPROVED" ? "DRAFT" : status };
    case "claim":
      if (status !== "APPROVED") return deny("Le post n'est pas validé.");
      if (ctx.mode !== "AUTO") return deny("Ce post n'est pas publié automatiquement.");
      if (!ctx.campaignActive) return deny("La campagne n'est pas lancée.");
      return { ok: true, status: "PROCESSING" };
    case "publish_success":
      return status === "PROCESSING"
        ? { ok: true, status: "PUBLISHED" }
        : deny("Le post n'est pas en cours de publication.");
    case "publish_failure": {
      if (status !== "PROCESSING") return deny("Le post n'est pas en cours de publication.");
      const attempts = ctx.attempts + 1;
      return { ok: true, status: attempts >= MAX_ATTEMPTS ? "FAILED" : "APPROVED", attempts };
    }
    case "retry":
      return status === "FAILED"
        ? { ok: true, status: "APPROVED", attempts: 0 }
        : deny("Seul un post en échec peut être relancé.");
    case "studio_published":
      return status === "APPROVED" && ctx.mode === "STUDIO"
        ? { ok: true, status: "PUBLISHED" }
        : deny("Le post n'attend pas une mise en ligne YouTube.");
    case "kit_confirmed":
      return status === "APPROVED" && (ctx.mode === "KIT" || ctx.mode === null)
        ? { ok: true, status: "PUBLISHED" }
        : deny("Le post n'attend pas une confirmation de publication.");
  }
}

/** Whether a posts is complete enough to be submitted (text, or YouTube title for videos). */
export function isComplete(post: {
  format: PostFormat;
  body: string | null;
  youtubeTitle: string | null;
}): boolean {
  if (post.format === "SHORT" || post.format === "LONG_VIDEO") return !!post.youtubeTitle?.trim();
  return !!post.body?.trim();
}

/** Cuts before « …voir plus » like LinkedIn: at the fold, or at the 3rd line break, on a word. */
export function linkedinFold(text: string, fold: number = LIMITS.linkedinFold) {
  const lines = text.split("\n");
  const byLines = lines.length > 3 ? lines.slice(0, 3).join("\n") : text;
  if (byLines.length <= fold && byLines.length === text.length)
    return { visible: text, truncated: false };
  let cut = Math.min(fold, byLines.length);
  const space = byLines.lastIndexOf(" ", cut);
  if (space > fold * 0.6 && cut < byLines.length) cut = space;
  return { visible: byLines.slice(0, cut).trimEnd(), truncated: true };
}
