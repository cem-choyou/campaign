import "server-only";
import { env } from "@/env";
import InvitationEmail from "@/emails/invitation";
import { accessibleAccent, LIGHT_BACKGROUND, readableOn } from "@/lib/color";
import { roleLabels } from "@/lib/copy/common";
import type { BrandRole } from "@/lib/permissions";
import { normalizeEmail } from "@/server/auth/access";
import { generateToken, hashToken } from "@/server/auth/tokens";
import { db } from "@/server/db";
import { sendEmail } from "@/server/email/send";
import { AppError } from "@/server/errors";

export const INVITATION_TTL_DAYS = 7;

export function invitationExpiry(now = new Date()): Date {
  return new Date(now.getTime() + INVITATION_TTL_DAYS * 24 * 60 * 60 * 1000);
}

export type InvitationState = "valid" | "expired" | "revoked" | "accepted" | "unknown";

export function invitationState(
  invitation: { expiresAt: Date; acceptedAt: Date | null; revokedAt: Date | null } | null,
  now = new Date(),
): InvitationState {
  if (!invitation) return "unknown";
  if (invitation.revokedAt) return "revoked";
  if (invitation.acceptedAt) return "accepted";
  if (invitation.expiresAt <= now) return "expired";
  return "valid";
}

export function invitationUrl(token: string): string {
  return `${env.AUTH_URL.replace(/\/$/, "")}/invitation/${token}`;
}

/**
 * Invites someone to a brand. A pending invitation for the same address is replaced (acts as
 * "resend"). Returns whether the e-mail could be sent (it cannot without Resend in dev).
 */
export async function createInvitation(input: {
  brandId: string;
  email: string;
  role: BrandRole;
  clientCanApprove: boolean;
  invitedBy: { id: string; name: string | null; email: string };
}) {
  const email = normalizeEmail(input.email);
  const brand = await db.brand.findUniqueOrThrow({
    where: { id: input.brandId },
    select: { id: true, name: true, color: true },
  });

  const existingMember = await db.membership.findFirst({
    where: { brandId: brand.id, user: { email } },
    select: { id: true },
  });
  if (existingMember) {
    throw new AppError("CONFLICT", "Cette personne a déjà accès à la marque.");
  }

  const token = generateToken();
  const now = new Date();
  const invitation = await db.$transaction(async (tx) => {
    await tx.invitation.updateMany({
      where: { brandId: brand.id, email, acceptedAt: null, revokedAt: null },
      data: { revokedAt: now },
    });
    const created = await tx.invitation.create({
      data: {
        brandId: brand.id,
        email,
        role: input.role,
        clientCanApprove: input.role === "CLIENT" && input.clientCanApprove,
        tokenHash: hashToken(token),
        invitedById: input.invitedBy.id,
        expiresAt: invitationExpiry(now),
      },
    });
    await tx.activity.create({
      data: {
        brandId: brand.id,
        actorId: input.invitedBy.id,
        type: "invitation.sent",
        meta: { email, role: input.role },
      },
    });
    return created;
  });

  const accent = accessibleAccent(brand.color, LIGHT_BACKGROUND);
  const url = invitationUrl(token);
  const result = await sendEmail({
    to: email,
    subject: `Invitation à rejoindre ${brand.name} sur Campaign`,
    replyTo: input.invitedBy.email,
    react: InvitationEmail({
      url,
      appUrl: env.AUTH_URL,
      brandName: brand.name,
      inviterName: input.invitedBy.name ?? input.invitedBy.email,
      roleLabel: roleLabels[input.role],
      accent,
      accentForeground: readableOn(accent),
    }),
  });

  return {
    invitation,
    emailSent: result.ok,
    // Only exposed when e-mails are disabled (dev), so the link can still be shared by hand.
    devUrl: result.ok ? undefined : url,
  };
}

export async function findInvitationByToken(token: string) {
  return db.invitation.findUnique({
    where: { tokenHash: hashToken(token) },
    include: {
      brand: { select: { id: true, name: true, slug: true, color: true, logoUrl: true } },
    },
  });
}

/** Accepts an invitation for the signed-in user, whose e-mail must match. */
export async function acceptInvitation(token: string, user: { id: string; email: string }) {
  const invitation = await findInvitationByToken(token);
  const state = invitationState(invitation);
  if (!invitation || state === "unknown" || state === "revoked" || state === "expired") {
    throw new AppError("NOT_FOUND", "Cette invitation n'est plus valable.");
  }
  if (normalizeEmail(user.email) !== invitation.email) {
    throw new AppError("FORBIDDEN", "Cette invitation est destinée à une autre adresse e-mail.");
  }
  if (state === "valid") {
    await db.$transaction([
      db.membership.upsert({
        where: { userId_brandId: { userId: user.id, brandId: invitation.brandId } },
        create: {
          userId: user.id,
          brandId: invitation.brandId,
          role: invitation.role,
          clientCanApprove: invitation.clientCanApprove,
        },
        update: { role: invitation.role, clientCanApprove: invitation.clientCanApprove },
      }),
      db.invitation.update({ where: { id: invitation.id }, data: { acceptedAt: new Date() } }),
      db.activity.create({
        data: {
          brandId: invitation.brandId,
          actorId: user.id,
          type: "membership.joined",
          meta: { role: invitation.role },
        },
      }),
    ]);
  }
  return invitation.brand;
}
