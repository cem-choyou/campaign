import "server-only";
import type { z } from "zod";
import { uniqueSlug } from "@/lib/slug";
import type {
  brandCreateSchema,
  brandGeneralSchema,
  contributorSchema,
  membershipUpdateSchema,
  socialAccountSchema,
} from "@/lib/validations/brand";
import { db } from "@/server/db";
import { AppError } from "@/server/errors";

type Actor = { id: string };

// ---------- Brand ----------

export async function createBrand(input: z.output<typeof brandCreateSchema>, actor: Actor) {
  const slug = await uniqueSlug(input.name, async (s) =>
    Boolean(await db.brand.findUnique({ where: { slug: s }, select: { id: true } })),
  );
  return db.$transaction(async (tx) => {
    const brand = await tx.brand.create({
      data: { name: input.name, slug, color: input.color },
    });
    // The creator administers the brand explicitly (useful if they lose super admin rights).
    await tx.membership.create({ data: { userId: actor.id, brandId: brand.id, role: "ADMIN" } });
    await tx.activity.create({
      data: {
        brandId: brand.id,
        actorId: actor.id,
        type: "brand.created",
        meta: { name: brand.name },
      },
    });
    return brand;
  });
}

export async function updateBrandGeneral(input: z.output<typeof brandGeneralSchema>, actor: Actor) {
  const brand = await db.brand.update({
    where: { id: input.brandId },
    data: {
      name: input.name,
      color: input.color,
      logoUrl: input.logoUrl ?? null,
      timezone: input.timezone,
    },
    select: { id: true, slug: true },
  });
  await db.activity.create({
    data: { brandId: brand.id, actorId: actor.id, type: "brand.updated" },
  });
  return brand;
}

// ---------- Social accounts ----------

export async function listSocialAccounts(brandId: string) {
  return db.socialAccount.findMany({
    where: { brandId },
    select: {
      id: true,
      platform: true,
      name: true,
      url: true,
      publishMode: true,
      isActive: true,
      kitContributorId: true,
      kitContributor: { select: { firstName: true, lastName: true } },
      _count: { select: { posts: { where: { deletedAt: null } } } },
    },
    orderBy: [{ isActive: "desc" }, { platform: "asc" }, { name: "asc" }],
  });
}

export async function saveSocialAccount(input: z.output<typeof socialAccountSchema>, actor: Actor) {
  if (input.kitContributorId) {
    const contributor = await db.contributor.findFirst({
      where: { id: input.kitContributorId, brandId: input.brandId },
      select: { id: true },
    });
    if (!contributor) throw new AppError("INVALID", "Ce relais n'appartient pas à la marque.");
  }
  const data = {
    platform: input.platform,
    name: input.name,
    url: input.url ?? null,
    publishMode: input.publishMode,
    kitContributorId: input.kitContributorId,
  };
  if (input.accountId) {
    const existing = await db.socialAccount.findFirst({
      where: { id: input.accountId, brandId: input.brandId },
      select: { id: true },
    });
    if (!existing) throw new AppError("NOT_FOUND");
    return db.socialAccount.update({ where: { id: existing.id }, data });
  }
  const account = await db.socialAccount.create({ data: { ...data, brandId: input.brandId } });
  await db.activity.create({
    data: {
      brandId: input.brandId,
      actorId: actor.id,
      type: "account.created",
      meta: { name: account.name },
    },
  });
  return account;
}

export async function setSocialAccountActive(
  brandId: string,
  accountId: string,
  isActive: boolean,
) {
  const { count } = await db.socialAccount.updateMany({
    where: { id: accountId, brandId },
    data: { isActive },
  });
  if (count === 0) throw new AppError("NOT_FOUND");
}

// ---------- Contributors ----------

export async function listContributors(brandId: string) {
  return db.contributor.findMany({
    where: { brandId },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      jobTitle: true,
      linkedinUrl: true,
      isActive: true,
      _count: { select: { authored: { where: { deletedAt: null } } } },
    },
    orderBy: [{ isActive: "desc" }, { firstName: "asc" }],
  });
}

export async function saveContributor(input: z.output<typeof contributorSchema>, actor: Actor) {
  const duplicate = await db.contributor.findFirst({
    where: {
      brandId: input.brandId,
      email: input.email,
      ...(input.contributorId ? { NOT: { id: input.contributorId } } : {}),
    },
    select: { id: true },
  });
  if (duplicate) throw new AppError("CONFLICT", "Un relais utilise déjà cette adresse e-mail.");

  const data = {
    firstName: input.firstName,
    lastName: input.lastName ?? null,
    email: input.email,
    jobTitle: input.jobTitle ?? null,
    linkedinUrl: input.linkedinUrl ?? null,
  };
  if (input.contributorId) {
    const { count } = await db.contributor.updateMany({
      where: { id: input.contributorId, brandId: input.brandId },
      data,
    });
    if (count === 0) throw new AppError("NOT_FOUND");
    return;
  }
  await db.contributor.create({ data: { ...data, brandId: input.brandId } });
  await db.activity.create({
    data: {
      brandId: input.brandId,
      actorId: actor.id,
      type: "contributor.created",
      meta: { firstName: input.firstName },
    },
  });
}

export async function setContributorActive(
  brandId: string,
  contributorId: string,
  isActive: boolean,
) {
  const { count } = await db.contributor.updateMany({
    where: { id: contributorId, brandId },
    data: { isActive },
  });
  if (count === 0) throw new AppError("NOT_FOUND");
}

// ---------- Access ----------

export async function listAccess(brandId: string) {
  const [members, invitations] = await Promise.all([
    db.membership.findMany({
      where: { brandId },
      select: {
        id: true,
        role: true,
        clientCanApprove: true,
        createdAt: true,
        user: { select: { id: true, name: true, email: true, image: true, isActive: true } },
      },
      orderBy: { createdAt: "asc" },
    }),
    db.invitation.findMany({
      where: { brandId, acceptedAt: null, revokedAt: null },
      select: { id: true, email: true, role: true, expiresAt: true, createdAt: true },
      orderBy: { createdAt: "desc" },
    }),
  ]);
  return { members, invitations };
}

async function assertKeepsAnAdmin(brandId: string, membershipId: string) {
  const admins = await db.membership.count({
    where: { brandId, role: "ADMIN", NOT: { id: membershipId } },
  });
  if (admins === 0) {
    throw new AppError(
      "CONFLICT",
      "La marque doit garder au moins un administrateur. Nommez-en un autre d'abord.",
    );
  }
}

export async function updateMembership(
  input: z.output<typeof membershipUpdateSchema>,
  actor: Actor,
) {
  const membership = await db.membership.findFirst({
    where: { id: input.membershipId, brandId: input.brandId },
    select: { id: true, role: true, userId: true },
  });
  if (!membership) throw new AppError("NOT_FOUND");
  if (membership.role === "ADMIN" && input.role !== "ADMIN") {
    await assertKeepsAnAdmin(input.brandId, membership.id);
  }
  await db.membership.update({
    where: { id: membership.id },
    data: { role: input.role, clientCanApprove: input.role === "CLIENT" && input.clientCanApprove },
  });
  await db.activity.create({
    data: {
      brandId: input.brandId,
      actorId: actor.id,
      type: "membership.role_changed",
      meta: { userId: membership.userId, role: input.role },
    },
  });
}

export async function removeMembership(brandId: string, membershipId: string, actor: Actor) {
  const membership = await db.membership.findFirst({
    where: { id: membershipId, brandId },
    select: { id: true, role: true, userId: true },
  });
  if (!membership) throw new AppError("NOT_FOUND");
  if (membership.role === "ADMIN") await assertKeepsAnAdmin(brandId, membership.id);
  await db.membership.delete({ where: { id: membership.id } });
  await db.activity.create({
    data: {
      brandId,
      actorId: actor.id,
      type: "membership.removed",
      meta: { userId: membership.userId },
    },
  });
}

export async function revokeInvitation(brandId: string, invitationId: string) {
  const { count } = await db.invitation.updateMany({
    where: { id: invitationId, brandId, acceptedAt: null, revokedAt: null },
    data: { revokedAt: new Date() },
  });
  if (count === 0) throw new AppError("NOT_FOUND");
}
