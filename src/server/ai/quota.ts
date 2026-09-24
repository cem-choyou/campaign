import "server-only";
import { randomUUID } from "node:crypto";
import { env } from "@/env";
import { aiCopy } from "@/lib/copy/ai";
import { parseDateOnly, todayLocal } from "@/lib/dates";
import { db } from "@/server/db";
import { AppError } from "@/server/errors";
import { rateLimit } from "@/server/rate-limit";

// Spend guards (§9.6): a daily cap per brand (in the brand's time zone) and a short-term rate
// limit per user. Both are checked before calling the model; a failed call still counts.

const PER_MINUTE = 30;

export async function consumeAi(
  brand: { id: string; timezone: string },
  userId: string,
  count = 1,
  now = new Date(),
): Promise<{ used: number; limit: number }> {
  const burst = rateLimit(`ai:${userId}`, PER_MINUTE, 60_000, now.getTime());
  if (!burst.ok) throw new AppError("CONFLICT", aiCopy.errors.tooFast);

  const limit = env.AI_DAILY_LIMIT_PER_BRAND;
  if (count > limit) throw new AppError("CONFLICT", aiCopy.errors.dailyLimit(limit));
  const day = parseDateOnly(todayLocal(brand.timezone, now));
  // Atomic "increment if below the cap": no row returned means the cap is reached.
  const rows = await db.$queryRaw<{ count: number }[]>`
    INSERT INTO "AiUsage" ("id", "brandId", "day", "count")
    VALUES (${randomUUID()}, ${brand.id}, ${day}, ${count})
    ON CONFLICT ("brandId", "day")
    DO UPDATE SET "count" = "AiUsage"."count" + ${count}
    WHERE "AiUsage"."count" + ${count} <= ${limit}
    RETURNING "count"`;
  const used = rows[0]?.count;
  if (used === undefined || used > limit) {
    throw new AppError("CONFLICT", aiCopy.errors.dailyLimit(limit));
  }
  return { used, limit };
}

export async function aiUsageToday(brand: { id: string; timezone: string }, now = new Date()) {
  const day = parseDateOnly(todayLocal(brand.timezone, now));
  const row = await db.aiUsage.findUnique({
    where: { brandId_day: { brandId: brand.id, day } },
    select: { count: true },
  });
  return { used: row?.count ?? 0, limit: env.AI_DAILY_LIMIT_PER_BRAND };
}
