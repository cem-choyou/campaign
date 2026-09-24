import "server-only";
import type { z } from "zod";
import { formatDay, localToUtc, shiftLocalDays, toLocalParts, withLocalTime } from "@/lib/dates";
import {
  type Platform,
  type PostFormat,
  type PostStatus,
  checkSchedule,
  decodePublisher,
  isFormatAllowed,
  isLocked,
  touchesApprovedContent,
} from "@/lib/posts";
import type { postCreateSchema, postMoveSchema, postUpdateSchema } from "@/lib/validations/post";
import { db } from "@/server/db";
import { AppError } from "@/server/errors";

type Actor = { id: string };

const PAST_MESSAGE = "Cette date est déjà passée. Choisissez un moment à venir.";

// ---------- Reads ----------

const postListSelect = {
  id: true,
  campaignId: true,
  status: true,
  format: true,
  scheduledAt: true,
  angle: true,
  body: true,
  bodySource: true,
  youtubeTitle: true,
  socialAccountId: true,
  authorContributorId: true,
  contentId: true,
  content: { select: { id: true, code: true, title: true, mediaUrl: true } },
  socialAccount: { select: { id: true, name: true, platform: true, publishMode: true } },
  authorContributor: { select: { id: true, firstName: true, lastName: true } },
} as const;

export async function listCampaignPosts(campaignId: string) {
  return db.post.findMany({
    where: { campaignId, deletedAt: null },
    select: postListSelect,
    orderBy: { scheduledAt: "asc" },
  });
}

const DAY_MS = 86_400_000;

/** Posts of every non-archived campaign of a brand, from 6 months ago to 13 months ahead. */
export async function listBrandPosts(brandId: string, now = Date.now()) {
  const from = new Date(now - 180 * DAY_MS);
  const to = new Date(now + 400 * DAY_MS);
  return db.post.findMany({
    where: {
      deletedAt: null,
      scheduledAt: { gte: from, lt: to },
      campaign: { brandId, archivedAt: null },
    },
    select: { ...postListSelect, campaign: { select: { id: true, name: true } } },
    orderBy: { scheduledAt: "asc" },
  });
}

export type PostListItem = Awaited<ReturnType<typeof listCampaignPosts>>[number];

export async function getPostForEditor(postId: string, brandId: string) {
  return db.post.findFirst({
    where: { id: postId, deletedAt: null, campaign: { brandId } },
    select: {
      ...postListSelect,
      youtubeDescription: true,
      youtubeTags: true,
      linkToContentId: true,
      linkToUrl: true,
      relatedVideoAdded: true,
      rejectionReason: true,
      publishedUrl: true,
      updatedAt: true,
    },
  });
}

export type EditorPost = NonNullable<Awaited<ReturnType<typeof getPostForEditor>>>;

/** Accounts, contributors and contents a post of this campaign can use. */
export async function getPostOptions(campaignId: string, brandId: string) {
  const [accounts, contributors, contents] = await Promise.all([
    db.socialAccount.findMany({
      where: { brandId, isActive: true },
      select: { id: true, name: true, platform: true, publishMode: true },
      orderBy: [{ platform: "asc" }, { name: "asc" }],
    }),
    db.contributor.findMany({
      where: { brandId, isActive: true },
      select: { id: true, firstName: true, lastName: true },
      orderBy: { firstName: "asc" },
    }),
    db.content.findMany({
      where: { campaignId, deletedAt: null },
      select: {
        id: true,
        code: true,
        title: true,
        type: true,
        mediaUrl: true,
        youtubeVideoId: true,
      },
      orderBy: { code: "asc" },
    }),
  ]);
  return { accounts, contributors, contents };
}

export type PostOptions = Awaited<ReturnType<typeof getPostOptions>>;

// ---------- Helpers ----------

async function loadCampaign(campaignId: string) {
  return db.campaign.findUniqueOrThrow({
    where: { id: campaignId },
    select: { id: true, brandId: true, brand: { select: { timezone: true } } },
  });
}

/** Resolves the publisher and checks it belongs to the brand; returns the platform. */
async function resolvePublisher(value: string, brandId: string) {
  const publisher = decodePublisher(value);
  if (!publisher) throw new AppError("INVALID", "Choisissez un compte ou un relais.");
  if (publisher.kind === "account") {
    const account = await db.socialAccount.findFirst({
      where: { id: publisher.id, brandId },
      select: { platform: true },
    });
    if (!account) throw new AppError("INVALID", "Ce compte n'appartient pas à la marque.");
    return {
      platform: account.platform as Platform,
      data: { socialAccountId: publisher.id, authorContributorId: null },
    };
  }
  const contributor = await db.contributor.findFirst({
    where: { id: publisher.id, brandId },
    select: { id: true },
  });
  if (!contributor) throw new AppError("INVALID", "Ce relais n'appartient pas à la marque.");
  // A contributor publishes from their LinkedIn profile.
  return {
    platform: "LINKEDIN" as Platform,
    data: { socialAccountId: null, authorContributorId: publisher.id },
  };
}

async function assertContentInCampaign(contentId: string | null | undefined, campaignId: string) {
  if (!contentId) return;
  const found = await db.content.count({ where: { id: contentId, campaignId, deletedAt: null } });
  if (!found) throw new AppError("INVALID", "Ce contenu n'appartient pas à la campagne.");
}

function assertFormat(platform: Platform, format: PostFormat) {
  if (!isFormatAllowed(platform, format)) {
    throw new AppError(
      "INVALID",
      platform === "YOUTUBE"
        ? "Sur YouTube, choisissez le format Short ou Vidéo longue."
        : "Ce format n'est pas disponible sur LinkedIn.",
    );
  }
}

// ---------- Writes ----------

export async function createPost(input: z.output<typeof postCreateSchema>, actor: Actor) {
  const campaign = await loadCampaign(input.campaignId);
  const tz = campaign.brand.timezone;
  const scheduledAt = localToUtc(input.date, input.time, tz);
  const check = checkSchedule(scheduledAt);
  if (!check.ok) throw new AppError("INVALID", PAST_MESSAGE);

  const { platform, data } = await resolvePublisher(input.publisher, campaign.brandId);
  assertFormat(platform, input.format);
  await assertContentInCampaign(input.contentId, campaign.id);

  return db.$transaction(async (tx) => {
    const post = await tx.post.create({
      data: {
        campaignId: campaign.id,
        ...data,
        format: input.format,
        scheduledAt,
        contentId: input.contentId ?? null,
        angle: input.angle?.trim() || null,
      },
      select: { id: true },
    });
    await tx.activity.create({
      data: {
        brandId: campaign.brandId,
        campaignId: campaign.id,
        postId: post.id,
        actorId: actor.id,
        type: "post.created",
        meta: { label: `pour le ${formatDay(scheduledAt, tz)}` },
      },
    });
    return { id: post.id, warning: check.warning };
  });
}

/**
 * Editor autosave. Changing the text or the media of an approved post sends it back to draft,
 * only with `confirmReset` (the editor asks first). Locked posts cannot change.
 */
export async function updatePost(input: z.output<typeof postUpdateSchema>, actor: Actor) {
  const post = await db.post.findUnique({
    where: { id: input.postId },
    select: {
      id: true,
      status: true,
      format: true,
      scheduledAt: true,
      deletedAt: true,
      socialAccountId: true,
      authorContributorId: true,
      socialAccount: { select: { platform: true } },
      campaign: { select: { id: true, brandId: true, brand: { select: { timezone: true } } } },
    },
  });
  if (!post || post.deletedAt) throw new AppError("NOT_FOUND");
  const status = post.status as PostStatus;
  if (isLocked(status)) {
    throw new AppError(
      "CONFLICT",
      "Ce post est en cours de publication ou déjà publié : il ne peut plus être modifié.",
    );
  }

  const { postId, confirmReset, date, time, publisher, ...fields } = input;
  const data: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(fields)) if (value !== undefined) data[key] = value;

  const resets = status === "APPROVED" && touchesApprovedContent({ ...fields, publisher });
  if (resets && !confirmReset) {
    throw new AppError(
      "CONFLICT",
      "Ce post est validé. Le modifier demandera une nouvelle validation.",
    );
  }

  let platform: Platform = (post.socialAccount?.platform as Platform | undefined) ?? "LINKEDIN";
  if (publisher) {
    const resolved = await resolvePublisher(publisher, post.campaign.brandId);
    platform = resolved.platform;
    Object.assign(data, resolved.data);
  }
  assertFormat(platform, (fields.format ?? post.format) as PostFormat);
  await assertContentInCampaign(fields.contentId, post.campaign.id);
  await assertContentInCampaign(fields.linkToContentId, post.campaign.id);

  if (date || time) {
    const tz = post.campaign.brand.timezone;
    const current = toLocalParts(post.scheduledAt, tz);
    const scheduledAt = localToUtc(date ?? current.date, time ?? current.time, tz);
    if (scheduledAt.getTime() !== post.scheduledAt.getTime()) {
      if (!checkSchedule(scheduledAt).ok) throw new AppError("INVALID", PAST_MESSAGE);
      data.scheduledAt = scheduledAt;
    }
  }
  if (fields.body !== undefined) data.bodySource = fields.body ? "HUMAN" : "EMPTY";
  if (resets) Object.assign(data, { status: "DRAFT", approvedById: null, approvedAt: null });

  const updated = await db.post.update({
    where: { id: postId },
    data,
    select: { id: true, status: true, scheduledAt: true, updatedAt: true },
  });
  if (resets) {
    await db.activity.create({
      data: {
        brandId: post.campaign.brandId,
        campaignId: post.campaign.id,
        postId,
        actorId: actor.id,
        type: "post.status_changed",
        meta: { from: "APPROVED", to: "DRAFT", reason: "edited" },
      },
    });
  }
  return updated;
}

/** Drag and drop / quick move. The time is kept unless a new one is given. */
export async function movePost(input: z.output<typeof postMoveSchema>, actor: Actor) {
  const post = await db.post.findUnique({
    where: { id: input.postId },
    select: {
      id: true,
      status: true,
      scheduledAt: true,
      deletedAt: true,
      campaign: { select: { id: true, brandId: true, brand: { select: { timezone: true } } } },
    },
  });
  if (!post || post.deletedAt) throw new AppError("NOT_FOUND");
  if (isLocked(post.status as PostStatus)) {
    throw new AppError(
      "CONFLICT",
      "Un post publié ou en cours de publication ne peut pas être déplacé.",
    );
  }
  const tz = post.campaign.brand.timezone;
  const time = input.time ?? toLocalParts(post.scheduledAt, tz).time;
  const scheduledAt = localToUtc(input.date, time, tz);
  const check = checkSchedule(scheduledAt);
  if (!check.ok) throw new AppError("INVALID", PAST_MESSAGE);

  // Moving an approved post keeps its validation: the content did not change (§6.3).
  await db.$transaction([
    db.post.update({ where: { id: post.id }, data: { scheduledAt } }),
    db.activity.create({
      data: {
        brandId: post.campaign.brandId,
        campaignId: post.campaign.id,
        postId: post.id,
        actorId: actor.id,
        type: "post.moved",
        meta: { to: formatDay(scheduledAt, tz), previous: post.scheduledAt.toISOString() },
      },
    }),
  ]);
  return {
    previous: post.scheduledAt.toISOString(),
    scheduledAt: scheduledAt.toISOString(),
    warning: check.warning,
  };
}

/** Loads editable posts of one brand; refuses mixing brands or touching locked posts. */
async function loadBulk(postIds: string[]) {
  const posts = await db.post.findMany({
    where: { id: { in: postIds }, deletedAt: null },
    select: {
      id: true,
      status: true,
      scheduledAt: true,
      campaign: { select: { id: true, brandId: true, brand: { select: { timezone: true } } } },
    },
  });
  if (posts.length === 0) throw new AppError("NOT_FOUND");
  const brandIds = new Set(posts.map((p) => p.campaign.brandId));
  if (brandIds.size > 1) throw new AppError("INVALID");
  return posts;
}

export async function brandOfPosts(postIds: string[]) {
  const post = await db.post.findFirst({
    where: { id: { in: postIds } },
    select: { campaign: { select: { brandId: true } } },
  });
  if (!post) throw new AppError("NOT_FOUND");
  return post.campaign.brandId;
}

export async function shiftPosts(postIds: string[], days: number, actor: Actor) {
  const posts = (await loadBulk(postIds)).filter((p) => !isLocked(p.status as PostStatus));
  const now = new Date();
  const moves = posts.map((p) => ({
    id: p.id,
    previous: p.scheduledAt,
    next: shiftLocalDays(p.scheduledAt, days, p.campaign.brand.timezone),
  }));
  if (moves.some((m) => !checkSchedule(m.next, now).ok)) {
    throw new AppError(
      "INVALID",
      "Certains posts se retrouveraient dans le passé. Choisissez un autre décalage.",
    );
  }
  await db.$transaction([
    ...moves.map((m) => db.post.update({ where: { id: m.id }, data: { scheduledAt: m.next } })),
    db.activity.create({
      data: {
        brandId: posts[0]!.campaign.brandId,
        campaignId: posts[0]!.campaign.id,
        actorId: actor.id,
        type: "post.bulk_moved",
        meta: { count: moves.length, days },
      },
    }),
  ]);
  return {
    moved: moves.length,
    skipped: postIds.length - moves.length,
    previous: moves.map((m) => ({ id: m.id, scheduledAt: m.previous.toISOString() })),
  };
}

export async function setPostsTime(postIds: string[], time: string, actor: Actor) {
  const posts = (await loadBulk(postIds)).filter((p) => !isLocked(p.status as PostStatus));
  const now = new Date();
  const moves = posts.map((p) => ({
    id: p.id,
    previous: p.scheduledAt,
    next: withLocalTime(p.scheduledAt, time, p.campaign.brand.timezone),
  }));
  if (moves.some((m) => !checkSchedule(m.next, now).ok)) {
    throw new AppError(
      "INVALID",
      "Certains posts se retrouveraient dans le passé. Choisissez une autre heure.",
    );
  }
  await db.$transaction([
    ...moves.map((m) => db.post.update({ where: { id: m.id }, data: { scheduledAt: m.next } })),
    db.activity.create({
      data: {
        brandId: posts[0]!.campaign.brandId,
        campaignId: posts[0]!.campaign.id,
        actorId: actor.id,
        type: "post.bulk_moved",
        meta: { count: moves.length, time },
      },
    }),
  ]);
  return {
    moved: moves.length,
    previous: moves.map((m) => ({ id: m.id, scheduledAt: m.previous.toISOString() })),
  };
}

/** Restores previous dates (undo of a move / shift / time change). */
export async function restorePostDates(items: { id: string; scheduledAt: string }[]) {
  const posts = await loadBulk(items.map((i) => i.id));
  const allowed = new Set(posts.filter((p) => !isLocked(p.status as PostStatus)).map((p) => p.id));
  await db.$transaction(
    items
      .filter((i) => allowed.has(i.id))
      .map((i) =>
        db.post.update({ where: { id: i.id }, data: { scheduledAt: new Date(i.scheduledAt) } }),
      ),
  );
}

/** Soft delete (undo possible). Published posts are kept. */
export async function deletePosts(postIds: string[], actor: Actor) {
  const posts = (await loadBulk(postIds)).filter((p) => p.status !== "PUBLISHED");
  const ids = posts.map((p) => p.id);
  await db.$transaction([
    db.post.updateMany({ where: { id: { in: ids } }, data: { deletedAt: new Date() } }),
    db.activity.create({
      data: {
        brandId: posts[0]!.campaign.brandId,
        campaignId: posts[0]!.campaign.id,
        actorId: actor.id,
        type: "post.deleted",
        meta: { count: ids.length },
      },
    }),
  ]);
  return { deleted: ids };
}

export async function restorePosts(postIds: string[]) {
  await db.post.updateMany({ where: { id: { in: postIds } }, data: { deletedAt: null } });
}
