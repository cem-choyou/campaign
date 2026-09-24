import "server-only";
import { PrismaAdapter } from "@auth/prisma-adapter";
import NextAuth from "next-auth";
import type { Provider } from "next-auth/providers";
import Google from "next-auth/providers/google";
import Resend from "next-auth/providers/resend";
import { env } from "@/env";
import MagicLinkEmail from "@/emails/magic-link";
import {
  acceptPendingInvitations,
  canReceiveMagicLink,
  isAllowedGoogleEmail,
  normalizeEmail,
} from "@/server/auth/access";
import { db } from "@/server/db";
import { isEmailEnabled, sendEmail } from "@/server/email/send";
import { logger } from "@/server/logger";

const DAY = 24 * 60 * 60;

export const SIGN_IN_PATH = "/connexion";
/** Same page whether or not the address is allowed: no account enumeration. */
export const LINK_SENT_PATH = "/connexion/envoye";

/** Magic links are available with Resend, or in development (link printed in the logs). */
export const magicLinkEnabled =
  isEmailEnabled() || env.NODE_ENV === "development" || env.EMAIL_TRANSPORT === "log";

const providers: Provider[] = [
  Google({
    clientId: env.AUTH_GOOGLE_ID,
    clientSecret: env.AUTH_GOOGLE_SECRET,
    authorization: { params: { hd: env.ALLOWED_GOOGLE_DOMAIN, prompt: "select_account" } },
    // Workspace e-mails are verified by Google (and checked in signIn): linking an invited
    // user created by magic link to their Google account is safe.
    allowDangerousEmailAccountLinking: true,
  }),
];

if (magicLinkEnabled) {
  providers.push(
    Resend({
      apiKey: env.RESEND_API_KEY,
      from: env.EMAIL_FROM,
      maxAge: DAY,
      normalizeIdentifier: normalizeEmail,
      async sendVerificationRequest({ identifier, url }) {
        if (!isEmailEnabled()) {
          logger.info("auth.magic_link.dev", { url });
          return;
        }
        const result = await sendEmail({
          to: identifier,
          subject: "Votre lien de connexion à Campaign",
          react: MagicLinkEmail({ url, appUrl: env.AUTH_URL }),
        });
        if (!result.ok) throw new Error("magic link e-mail not sent");
      },
    }),
  );
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(db),
  providers,
  trustHost: true,
  session: { strategy: "database", maxAge: 30 * DAY, updateAge: DAY },
  pages: { signIn: SIGN_IN_PATH, verifyRequest: LINK_SENT_PATH, error: SIGN_IN_PATH },
  callbacks: {
    async signIn({ user, account, profile, email }) {
      if (account?.provider === "google") {
        const verified = profile?.email_verified === true;
        if (!verified || !isAllowedGoogleEmail(profile?.email, env.ALLOWED_GOOGLE_DOMAIN)) {
          return `${SIGN_IN_PATH}?error=Domaine`;
        }
        const existing = await db.user.findUnique({
          where: { email: normalizeEmail(profile!.email!) },
          select: { isActive: true },
        });
        return existing?.isActive === false ? `${SIGN_IN_PATH}?error=Desactive` : true;
      }

      if (account?.provider === "resend") {
        const address = user.email ?? account.providerAccountId;
        const allowed = address ? await canReceiveMagicLink(address) : false;
        // Unknown addresses see the very same confirmation, but no e-mail is sent.
        if (email?.verificationRequest) return allowed ? true : LINK_SENT_PATH;
        return allowed || `${SIGN_IN_PATH}?error=Verification`;
      }

      return false;
    },
    session({ session, user }) {
      session.user.id = user.id;
      return session;
    },
  },
  events: {
    async signIn({ user }) {
      if (!user.id || !user.email) return;
      await acceptPendingInvitations(user.id, user.email);
      logger.info("auth.sign_in", { userId: user.id });
    },
  },
});
