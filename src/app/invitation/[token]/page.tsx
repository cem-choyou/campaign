import { AlertCircle, UserRoundX } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Logo } from "@/components/brand/logo";
import { LegalFooter } from "@/components/layout/legal-footer";
import { Button } from "@/components/ui/button";
import { roleLabels } from "@/lib/copy/common";
import { invitationCopy } from "@/lib/copy/invitations";
import { env } from "@/env";
import { isAllowedGoogleEmail } from "@/server/auth/access";
import { signOut } from "@/server/auth/config";
import { getCurrentUser } from "@/server/auth/session";
import { acceptInvitation, findInvitationByToken, invitationState } from "@/server/invitations";
import { InvitationSignIn } from "./invitation-sign-in";

export const metadata: Metadata = { title: invitationCopy.pageTitle };

export default async function InvitationPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const invitation = await findInvitationByToken(token);
  const state = invitationState(invitation);
  const user = await getCurrentUser();

  // Already accepted (e.g. at sign-in): go straight to the brand.
  if (invitation && state === "accepted" && user?.email === invitation.email) {
    redirect(`/${invitation.brand.slug}/aujourdhui`);
  }

  if (!invitation || state !== "valid") {
    return (
      <Shell>
        <Icon tone="muted">
          <AlertCircle className="size-6" aria-hidden />
        </Icon>
        <h1 className="text-lg font-semibold">{invitationCopy.invalidTitle}</h1>
        <p className="text-muted-foreground mt-2">{invitationCopy.invalidBody}</p>
        <Button asChild variant="outline" className="mt-6">
          <Link href="/connexion">{invitationCopy.toSignIn}</Link>
        </Button>
      </Shell>
    );
  }

  if (user) {
    if (user.email === invitation.email) {
      const brand = await acceptInvitation(token, user);
      redirect(`/${brand.slug}/aujourdhui`);
    }
    return (
      <Shell>
        <Icon tone="muted">
          <UserRoundX className="size-6" aria-hidden />
        </Icon>
        <h1 className="text-lg font-semibold">{invitationCopy.wrongAccountTitle}</h1>
        <p className="text-muted-foreground mt-2">
          {invitationCopy.wrongAccountBody(invitation.email, user.email)}
        </p>
        <form
          className="mt-6"
          action={async () => {
            "use server";
            await signOut({ redirectTo: `/invitation/${token}` });
          }}
        >
          <Button type="submit" variant="outline">
            {invitationCopy.switchAccount}
          </Button>
        </form>
      </Shell>
    );
  }

  const useGoogle = isAllowedGoogleEmail(invitation.email, env.ALLOWED_GOOGLE_DOMAIN);
  return (
    <Shell>
      <h1 className="text-lg font-semibold">{invitationCopy.title(invitation.brand.name)}</h1>
      <p className="text-muted-foreground mt-2">
        {invitationCopy.body(roleLabels[invitation.role])}
      </p>
      <p className="bg-muted mt-4 rounded-lg px-3 py-2 text-xs">
        {invitationCopy.forEmail(invitation.email)}
      </p>
      <InvitationSignIn
        email={invitation.email}
        callbackUrl={`/invitation/${token}`}
        useGoogle={useGoogle}
      />
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="bg-muted/40 flex min-h-dvh flex-col items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex justify-center">
          <Logo />
        </div>
        <div className="bg-card rounded-xl border p-6 text-center shadow-[var(--shadow-soft)] sm:p-8">
          {children}
        </div>
      </div>
      <LegalFooter className="mt-10" />
    </main>
  );
}

function Icon({ children }: { children: React.ReactNode; tone: "muted" }) {
  return (
    <div className="bg-muted text-muted-foreground mx-auto mb-4 flex size-12 items-center justify-center rounded-full">
      {children}
    </div>
  );
}
