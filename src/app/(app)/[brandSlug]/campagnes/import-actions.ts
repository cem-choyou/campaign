"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { POST_FORMATS } from "@/lib/validations/post";
import { id } from "@/lib/validations/common";
import { runAction } from "@/server/errors";
import { commitImport, getImportJob, previewImport } from "@/server/import";
import { requireBrandPermission } from "@/server/permissions";

// Excel import (§8.8): corrections are re-validated on the server on every change, and once more
// right before the (transactional) import.

const overridesSchema = z
  .record(
    z.string().regex(/^\d+$/),
    z.object({
      publisher: z.string().max(80).optional(),
      contentCode: z.string().max(30).nullable().optional(),
      format: z.enum(POST_FORMATS).optional(),
      date: z.string().max(10).optional(),
      time: z.string().max(5).optional(),
      skip: z.boolean().optional(),
    }),
  )
  .default({})
  .transform((o) => Object.fromEntries(Object.entries(o).map(([k, v]) => [Number(k), v])));

const previewSchema = z.object({ brandId: id, jobId: id, overrides: overridesSchema });

export async function previewImportAction(input: z.input<typeof previewSchema>) {
  return runAction(previewSchema, input, async (data) => {
    const access = await requireBrandPermission({ brandId: data.brandId }, "campaign.edit");
    const job = await getImportJob(data.jobId, access.brand.id, access.user);
    return previewImport(job, access.brand.id, data.overrides, access.can("brand.manage"));
  });
}

const commitSchema = previewSchema.extend({ mode: z.enum(["add", "replace"]).default("add") });

export async function commitImportAction(input: z.input<typeof commitSchema>) {
  return runAction(commitSchema, input, async (data) => {
    const access = await requireBrandPermission({ brandId: data.brandId }, "campaign.edit");
    const result = await commitImport({
      jobId: data.jobId,
      brandId: access.brand.id,
      overrides: data.overrides,
      mode: data.mode,
      canCreateContributors: access.can("brand.manage"),
      actor: access.user,
    });
    revalidatePath(`/${access.brand.slug}`, "layout");
    return result;
  });
}
