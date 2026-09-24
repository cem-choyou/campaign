import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Logo } from "@/components/brand/logo";
import { LegalFooter } from "@/components/layout/legal-footer";
import { authCopy } from "@/lib/copy/auth";
import { safeCallbackPath } from "@/lib/safe-redirect";
import { magicLinkEnabled } from "@/server/auth/config";
import { getCurrentUser } from "@/server/auth/session";
import { SignInPanel } from "./sign-in-panel";

export const metadata: Metadata = { title: authCopy.pageTitle };

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const callbackUrl = safeCallbackPath(params.callbackUrl);

  if (await getCurrentUser()) redirect(callbackUrl);

  const errorKey = typeof params.error === "string" ? params.error : undefined;
  const error = errorKey ? (authCopy.errors[errorKey] ?? authCopy.errors.default) : undefined;

  return (
    <main className="bg-muted/40 flex min-h-dvh flex-col items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex justify-center">
          <Logo />
        </div>
        <SignInPanel
          callbackUrl={callbackUrl}
          sent={params.envoye === "1"}
          error={error}
          magicLinkEnabled={magicLinkEnabled}
        />
      </div>
      <LegalFooter className="mt-10" />
    </main>
  );
}
