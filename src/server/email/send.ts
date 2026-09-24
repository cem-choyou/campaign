import "server-only";
import { render, toPlainText } from "@react-email/components";
import type { ReactElement } from "react";
import { Resend } from "resend";
import { env } from "@/env";
import { logger } from "@/server/logger";

export type SendEmailInput = {
  to: string;
  subject: string;
  react: ReactElement;
  replyTo?: string;
};

export type SendEmailResult =
  { ok: true; id?: string } | { ok: false; skipped: boolean; error?: string };

const resend = env.RESEND_API_KEY ? new Resend(env.RESEND_API_KEY) : null;

export function isEmailEnabled(): boolean {
  return resend !== null;
}

/**
 * Sends an e-mail rendered by the app (magic links, invitations). Without RESEND_API_KEY the
 * module degrades gracefully: nothing is sent and the call is only logged (§15).
 */
export async function sendEmail(input: SendEmailInput): Promise<SendEmailResult> {
  const html = await render(input.react);
  const text = toPlainText(html);

  if (!resend) {
    logger.warn("email.skipped", { reason: "RESEND_API_KEY missing", subject: input.subject });
    return { ok: false, skipped: true };
  }

  const { data, error } = await resend.emails.send({
    from: env.EMAIL_FROM,
    to: input.to,
    subject: input.subject,
    html,
    text,
    replyTo: input.replyTo,
  });

  if (error) {
    logger.error("email.failed", { subject: input.subject, error: error.message });
    return { ok: false, skipped: false, error: error.message };
  }
  return { ok: true, id: data?.id };
}
