import "server-only";
import { notFound, redirect } from "next/navigation";
import { cache } from "react";
import {
  type AccessContext,
  type BrandRole,
  type Permission,
  can,
  hasRole,
} from "@/lib/permissions";
import { type CurrentUser, getCurrentUser } from "@/server/auth/session";
import { db } from "@/server/db";
import { AppError } from "@/server/errors";

export type BrandRef = { brandId: string } | { brandSlug: string };

const brandSelect = {
  id: true,
  name: true,
  slug: true,
  color: true,
  logoUrl: true,
  timezone: true,
  archivedAt: true,
} as const;

export type BrandSummary = {
  id: string;
  name: string;
  slug: string;
  color: string;
  logoUrl: string | null;
  timezone: string;
  archivedAt: Date | null;
};

export type BrandAccess = AccessContext & {
  user: CurrentUser;
  brand: BrandSummary;
  can: (permission: Permission) => boolean;
};

const findBrand = cache(async (key: string, by: "id" | "slug") =>
  db.brand.findUnique({
    where: by === "id" ? { id: key } : { slug: key },
    select: brandSelect,
  }),
);

/** Resolves the current user's access to a brand, or null if they have none. */
export async function getBrandAccess(ref: BrandRef): Promise<BrandAccess | null> {
  const user = await getCurrentUser();
  if (!user) return null;
  const brand =
    "brandId" in ref ? await findBrand(ref.brandId, "id") : await findBrand(ref.brandSlug, "slug");
  if (!brand || brand.archivedAt) return null;

  const membership = user.memberships.find((m) => m.brandId === brand.id);
  if (!membership && !user.isSuperAdmin) return null;

  const ctx: AccessContext = {
    isSuperAdmin: user.isSuperAdmin,
    role: membership?.role ?? null,
    clientCanApprove: membership?.clientCanApprove ?? false,
  };
  return { ...ctx, user, brand, can: (permission) => can(ctx, permission) };
}

/**
 * For Server Actions: throws an AppError (converted to `{ ok: false }` by runAction) when the
 * user cannot perform `permission` on the brand. A brand the user cannot see is "not found".
 */
export async function requireBrandPermission(ref: BrandRef, permission: Permission) {
  const access = await getBrandAccess(ref);
  if (!access) throw new AppError("NOT_FOUND");
  if (!access.can(permission)) throw new AppError("FORBIDDEN");
  return access;
}

/** Role-based variant named in CLAUDE.md §7. */
export async function requireBrandRole(ref: BrandRef, minRole: BrandRole) {
  const access = await getBrandAccess(ref);
  if (!access) throw new AppError("NOT_FOUND");
  if (!access.isSuperAdmin && !hasRole(access.role, minRole)) throw new AppError("FORBIDDEN");
  return access;
}

/** For pages: 404 when the brand is invisible to the user, sign-in when not authenticated. */
export async function requireBrandPage(brandSlug: string, permission: Permission = "brand.view") {
  const user = await getCurrentUser();
  if (!user) redirect("/connexion");
  const access = await getBrandAccess({ brandSlug });
  if (!access || !access.can(permission)) notFound();
  return access;
}

export async function requireSuperAdmin() {
  const user = await getCurrentUser();
  if (!user) throw new AppError("UNAUTHENTICATED");
  if (!user.isSuperAdmin) throw new AppError("FORBIDDEN");
  return user;
}

/** Brands visible to the user (all active brands for a super admin). */
export async function listAccessibleBrands(user: CurrentUser) {
  return db.brand.findMany({
    where: {
      archivedAt: null,
      ...(user.isSuperAdmin ? {} : { id: { in: user.memberships.map((m) => m.brandId) } }),
    },
    select: brandSelect,
    orderBy: { name: "asc" },
  });
}

/** Resolves the brand owning a campaign, then checks the permission on it. */
export async function requireCampaignPermission(campaignId: string, permission: Permission) {
  const campaign = await db.campaign.findUnique({
    where: { id: campaignId },
    select: { id: true, brandId: true, status: true, archivedAt: true },
  });
  if (!campaign) throw new AppError("NOT_FOUND");
  const access = await requireBrandPermission({ brandId: campaign.brandId }, permission);
  return { ...access, campaign };
}
