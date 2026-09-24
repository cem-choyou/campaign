"use client";

import { Loader2 } from "lucide-react";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import {
  requestMagicLink,
  signInWithGoogle,
  type MagicLinkState,
} from "@/app/(auth)/connexion/actions";
import { Button } from "@/components/ui/button";
import { invitationCopy } from "@/lib/copy/invitations";

export function InvitationSignIn({
  email,
  callbackUrl,
  useGoogle,
}: {
  email: string;
  callbackUrl: string;
  useGoogle: boolean;
}) {
  const [state, action] = useActionState<MagicLinkState, FormData>(requestMagicLink, {});

  if (useGoogle) {
    return (
      <form action={signInWithGoogle} className="mt-6">
        <input type="hidden" name="callbackUrl" value={callbackUrl} />
        <Submit label={invitationCopy.continueGoogle} />
      </form>
    );
  }
  return (
    <form action={action} className="mt-6">
      <input type="hidden" name="callbackUrl" value={callbackUrl} />
      <input type="hidden" name="email" value={email} />
      <Submit label={invitationCopy.continueEmail} />
      {state.error && (
        <p role="alert" className="text-destructive mt-3 text-xs">
          {state.error}
        </p>
      )}
    </form>
  );
}

function Submit({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" className="h-10 w-full" disabled={pending}>
      {pending && <Loader2 className="size-4 animate-spin" aria-hidden />}
      {label}
    </Button>
  );
}
