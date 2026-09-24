import "server-only";
import { db } from "@/server/db";

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function isAllowedGoogleEmail(email: string | null | undefined, domain: string): boolean {
  if (!email) return false;
  return normalizeEmail(email).endsWith(`@${domain.toLowerCase()}`);
}

/** Magic links are sent only to active users or to people with a pending invitation (§9.1). */
export async function canReceiveMagicLink(email: string, now = new Date()): Promise<boolean> {
  const normalized = normalizeEmail(email);
  const user = await db.user.findUnique({
    where: { email: normalized },
    select: { isActive: true },
  });
  if (user) return user.isActive;
  const invitation = await db.invitation.findFirst({
    where: { email: normalized, acceptedAt: null, revokedAt: null, expiresAt: { gt: now } },
    select: { id: true },
  });
  return invitation !== null;
}

/** Turns every pending invitation for this e-mail into a membership. Returns the brand ids. */
export async function acceptPendingInvitations(userId: string, email: string, now = new Date()) {
  const invitations = await db.invitation.findMany({
    where: {
      email: normalizeEmail(email),
      acceptedAt: null,
      revokedAt: null,
      expiresAt: { gt: now },
    },
  });
  for (const invitation of invitations) {
    await db.$transaction([
      db.membership.upsert({
        where: { userId_brandId: { userId, brandId: invitation.brandId } },
        create: {
          userId,
          brandId: invitation.brandId,
          role: invitation.role,
          clientCanApprove: invitation.clientCanApprove,
        },
        update: { role: invitation.role, clientCanApprove: invitation.clientCanApprove },
      }),
      db.invitation.update({ where: { id: invitation.id }, data: { acceptedAt: now } }),
      db.activity.create({
        data: {
          brandId: invitation.brandId,
          actorId: userId,
          type: "membership.joined",
          meta: { role: invitation.role },
        },
      }),
    ]);
  }
  return invitations.map((i) => i.brandId);
}
