import "server-only";
import type { Permission } from "@/lib/permissions";
import { type PostAction, type PostStatus, transition } from "@/lib/posts";
import { db } from "@/server/db";
import { AppError } from "@/server/errors";
import { requireBrandPermission } from "@/server/permissions";

/**
 * The single entry point for post status changes (§6.3): checks rights, applies the state
 * machine, writes the Activity and triggers side effects. Lot 1 uses edit/cancel from the UI;
 * submit/approve/reject and the n8n actions are wired in lots 3-4.
 */

export type TransitionActor = { kind: "user"; brandId: string } | { kind: "system"; label: string }; // n8n, a contributor's kit…

const PERMISSION: Partial<Record<PostAction, Permission>> = {
  submit: "post.submit",
  approve: "post.approve",
  reject: "post.approve",
  cancel: "campaign.edit",
  edit: "campaign.edit",
  retry: "campaign.launch",
};

const ACTIVITY: Partial<Record<PostAction, string>> = {
  submit: "post.submitted",
  approve: "post.approved",
  reject: "post.rejected",
  cancel: "post.cancelled",
  publish_success: "post.published",
  studio_published: "post.published",
  kit_confirmed: "post.published",
  publish_failure: "post.failed",
  retry: "post.retried",
};

export async function applyTransition(
  postId: string,
  action: PostAction,
  actor: TransitionActor,
  extra: { reason?: string; externalId?: string; publishedUrl?: string; error?: string } = {},
) {
  const post = await db.post.findUnique({
    where: { id: postId },
    select: {
      id: true,
      status: true,
      attempts: true,
      deletedAt: true,
      campaign: { select: { id: true, brandId: true, status: true } },
      socialAccount: { select: { publishMode: true } },
    },
  });
  if (!post || post.deletedAt) throw new AppError("NOT_FOUND");

  let actorId: string | null = null;
  if (actor.kind === "user") {
    const permission = PERMISSION[action];
    if (!permission) throw new AppError("FORBIDDEN");
    if (actor.brandId !== post.campaign.brandId) throw new AppError("NOT_FOUND");
    const access = await requireBrandPermission({ brandId: post.campaign.brandId }, permission);
    actorId = access.user.id;
  }
  if (action === "reject" && !extra.reason?.trim()) {
    throw new AppError("INVALID", "Indiquez le motif du refus.");
  }

  const result = transition(post.status as PostStatus, action, {
    // A contributor post (no account) is published with a kit.
    mode: post.socialAccount?.publishMode ?? "KIT",
    campaignActive: post.campaign.status === "ACTIVE",
    attempts: post.attempts,
  });
  if (!result.ok) throw new AppError("CONFLICT", result.reason);

  const now = new Date();
  const data: Record<string, unknown> = { status: result.status };
  if (result.attempts !== undefined) data.attempts = result.attempts;
  if (action === "submit") data.submittedAt = now;
  if (action === "approve")
    Object.assign(data, { approvedById: actorId, approvedAt: now, rejectionReason: null });
  if (action === "reject") data.rejectionReason = extra.reason!.trim();
  if (action === "edit" && post.status === "APPROVED") {
    Object.assign(data, { approvedById: null, approvedAt: null });
  }
  if (action === "claim") data.lockedAt = now;
  if (["publish_success", "studio_published", "kit_confirmed"].includes(action)) {
    Object.assign(data, {
      publishedAt: now,
      lockedAt: null,
      externalId: extra.externalId ?? undefined,
      publishedUrl: extra.publishedUrl ?? undefined,
    });
  }
  if (action === "publish_failure")
    Object.assign(data, { lockedAt: null, lastError: extra.error ?? null });

  const activityType =
    ACTIVITY[action] ?? (result.status !== post.status ? "post.status_changed" : null);

  await db.$transaction([
    db.post.update({ where: { id: post.id }, data }),
    ...(activityType
      ? [
          db.activity.create({
            data: {
              brandId: post.campaign.brandId,
              campaignId: post.campaign.id,
              postId: post.id,
              actorId,
              actorLabel: actor.kind === "system" ? actor.label : null,
              type: activityType,
              meta: {
                from: post.status,
                to: result.status,
                ...(extra.reason ? { reason: extra.reason } : {}),
              },
            },
          }),
        ]
      : []),
  ]);

  // Side effects (Telegram validation webhook, alerts) are added with lots 3 and 4.
  return { from: post.status as PostStatus, to: result.status };
}
