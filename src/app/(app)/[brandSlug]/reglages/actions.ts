"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  brandGeneralSchema,
  contributorSchema,
  invitationSchema,
  membershipUpdateSchema,
  socialAccountSchema,
} from "@/lib/validations/brand";
import { id } from "@/lib/validations/common";
import {
  removeMembership,
  revokeInvitation,
  saveContributor,
  saveSocialAccount,
  setContributorActive,
  setSocialAccountActive,
  updateBrandGeneral,
  updateMembership,
} from "@/server/brands";
import { runAction } from "@/server/errors";
import { createInvitation } from "@/server/invitations";
import { requireBrandPermission } from "@/server/permissions";

// Every action re-checks rights on the server (§7), whatever the UI shows.

function refresh(slug: string) {
  revalidatePath(`/${slug}`, "layout");
}

export async function saveBrandGeneralAction(input: z.input<typeof brandGeneralSchema>) {
  return runAction(brandGeneralSchema, input, async (data) => {
    const access = await requireBrandPermission({ brandId: data.brandId }, "brand.manage");
    await updateBrandGeneral(data, access.user);
    refresh(access.brand.slug);
  });
}

export async function saveSocialAccountAction(input: z.input<typeof socialAccountSchema>) {
  return runAction(socialAccountSchema, input, async (data) => {
    const access = await requireBrandPermission({ brandId: data.brandId }, "brand.manage");
    await saveSocialAccount(data, access.user);
    refresh(access.brand.slug);
  });
}

const toggleSchema = z.object({ brandId: id, targetId: id, isActive: z.boolean() });

export async function setSocialAccountActiveAction(input: z.input<typeof toggleSchema>) {
  return runAction(toggleSchema, input, async (data) => {
    const access = await requireBrandPermission({ brandId: data.brandId }, "brand.manage");
    await setSocialAccountActive(data.brandId, data.targetId, data.isActive);
    refresh(access.brand.slug);
  });
}

export async function saveContributorAction(input: z.input<typeof contributorSchema>) {
  return runAction(contributorSchema, input, async (data) => {
    const access = await requireBrandPermission({ brandId: data.brandId }, "brand.manage");
    await saveContributor(data, access.user);
    refresh(access.brand.slug);
  });
}

export async function setContributorActiveAction(input: z.input<typeof toggleSchema>) {
  return runAction(toggleSchema, input, async (data) => {
    const access = await requireBrandPermission({ brandId: data.brandId }, "brand.manage");
    await setContributorActive(data.brandId, data.targetId, data.isActive);
    refresh(access.brand.slug);
  });
}

export async function inviteAction(input: z.input<typeof invitationSchema>) {
  return runAction(invitationSchema, input, async (data) => {
    const access = await requireBrandPermission({ brandId: data.brandId }, "access.manage");
    const result = await createInvitation({
      brandId: data.brandId,
      email: data.email,
      role: data.role,
      clientCanApprove: data.clientCanApprove,
      invitedBy: access.user,
    });
    refresh(access.brand.slug);
    return { emailSent: result.emailSent, devUrl: result.devUrl };
  });
}

export async function updateMembershipAction(input: z.input<typeof membershipUpdateSchema>) {
  return runAction(membershipUpdateSchema, input, async (data) => {
    const access = await requireBrandPermission({ brandId: data.brandId }, "access.manage");
    await updateMembership(data, access.user);
    refresh(access.brand.slug);
  });
}

const targetSchema = z.object({ brandId: id, targetId: id });

export async function removeMembershipAction(input: z.input<typeof targetSchema>) {
  return runAction(targetSchema, input, async (data) => {
    const access = await requireBrandPermission({ brandId: data.brandId }, "access.manage");
    await removeMembership(data.brandId, data.targetId, access.user);
    refresh(access.brand.slug);
  });
}

export async function revokeInvitationAction(input: z.input<typeof targetSchema>) {
  return runAction(targetSchema, input, async (data) => {
    const access = await requireBrandPermission({ brandId: data.brandId }, "access.manage");
    await revokeInvitation(data.brandId, data.targetId);
    refresh(access.brand.slug);
  });
}
