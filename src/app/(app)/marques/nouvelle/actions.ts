"use server";

import type { z } from "zod";
import { brandCreateSchema } from "@/lib/validations/brand";
import { createBrand } from "@/server/brands";
import { runAction } from "@/server/errors";
import { requireSuperAdmin } from "@/server/permissions";

export async function createBrandAction(input: z.input<typeof brandCreateSchema>) {
  return runAction(brandCreateSchema, input, async (data) => {
    const user = await requireSuperAdmin();
    const brand = await createBrand(data, user);
    return { slug: brand.slug };
  });
}
