"use server";

import { AuthError } from "next-auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { authCopy } from "@/lib/copy/auth";
import { safeCallbackPath } from "@/lib/safe-redirect";
import { LINK_SENT_PATH, magicLinkEnabled, signIn } from "@/server/auth/config";
import { normalizeEmail } from "@/server/auth/access";
import { logger } from "@/server/logger";
import { rateLimit } from "@/server/rate-limit";

export type MagicLinkState = { error?: string; email?: string };

const FIFTEEN_MIN = 15 * 60 * 1000;

async function clientIp(): Promise<string> {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "unknown";
}

export async function signInWithGoogle(formData: FormData) {
  await signIn("google", { redirectTo: safeCallbackPath(formData.get("callbackUrl")) });
}

export async function requestMagicLink(
  _prev: MagicLinkState,
  formData: FormData,
): Promise<MagicLinkState> {
  if (!magicLinkEnabled) return { error: authCopy.emailUnavailable };

  const raw = String(formData.get("email") ?? "");
  const parsed = z.email().safeParse(raw.trim());
  if (!parsed.success) return { error: authCopy.emailInvalid, email: raw };
  const email = normalizeEmail(parsed.data);

  const byIp = rateLimit(`magic:ip:${await clientIp()}`, 10, FIFTEEN_MIN);
  const byEmail = rateLimit(`magic:email:${email}`, 3, FIFTEEN_MIN);
  const limited = !byIp.ok ? byIp : !byEmail.ok ? byEmail : null;
  if (limited) {
    return { error: authCopy.rateLimited(Math.ceil(limited.retryAfterSec / 60)), email: raw };
  }

  try {
    await signIn("resend", {
      email,
      redirect: false,
      redirectTo: safeCallbackPath(formData.get("callbackUrl")),
    });
  } catch (error) {
    if (error instanceof AuthError) {
      logger.error("auth.magic_link.failed", { type: error.type });
      return { error: authCopy.errors.default, email: raw };
    }
    throw error;
  }
  // Same confirmation whether or not the address is allowed (no account enumeration).
  redirect(LINK_SENT_PATH);
}
