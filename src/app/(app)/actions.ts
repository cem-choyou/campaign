"use server";

import { z } from "zod";
import { signOut } from "@/server/auth/config";
import { requireUser } from "@/server/auth/session";
import { db } from "@/server/db";
import { runAction } from "@/server/errors";
import { requireBrandPermission } from "@/server/permissions";

export async function signOutAction() {
  await signOut({ redirectTo: "/connexion" });
}

const searchSchema = z.object({ brandId: z.string().min(1), query: z.string().trim().max(100) });

export type PaletteResults = {
  campaigns: { id: string; name: string; status: string }[];
  posts: { id: string; campaignId: string; label: string; scheduledAt: string }[];
};

/** ⌘K search: campaigns (name) and posts (content title, angle, text) of the active brand. */
export async function searchPalette(input: z.input<typeof searchSchema>) {
  return runAction(searchSchema, input, async ({ brandId, query }): Promise<PaletteResults> => {
    await requireUser();
    await requireBrandPermission({ brandId }, "brand.view");
    const contains = query ? { contains: query, mode: "insensitive" as const } : undefined;

    const [campaigns, posts] = await Promise.all([
      db.campaign.findMany({
        where: { brandId, archivedAt: null, ...(contains ? { name: contains } : {}) },
        select: { id: true, name: true, status: true },
        orderBy: { updatedAt: "desc" },
        take: 6,
      }),
      contains
        ? db.post.findMany({
            where: {
              deletedAt: null,
              campaign: { brandId, archivedAt: null },
              OR: [{ angle: contains }, { body: contains }, { content: { title: contains } }],
            },
            select: {
              id: true,
              campaignId: true,
              scheduledAt: true,
              angle: true,
              body: true,
              content: { select: { code: true, title: true } },
            },
            orderBy: { scheduledAt: "asc" },
            take: 6,
          })
        : Promise.resolve([]),
    ]);

    return {
      campaigns,
      posts: posts.map((p) => ({
        id: p.id,
        campaignId: p.campaignId,
        scheduledAt: p.scheduledAt.toISOString(),
        label: p.content?.title ?? p.angle ?? p.body?.slice(0, 60) ?? "Post sans titre",
      })),
    };
  });
}
