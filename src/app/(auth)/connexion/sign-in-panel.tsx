"use client";

import { AnimatePresence, motion } from "framer-motion";
import { AlertCircle, Loader2, MailCheck } from "lucide-react";
import Link from "next/link";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authCopy } from "@/lib/copy/auth";
import { requestMagicLink, signInWithGoogle, type MagicLinkState } from "./actions";

export function SignInPanel({
  callbackUrl,
  sent,
  error,
  magicLinkEnabled,
}: {
  callbackUrl: string;
  sent: boolean;
  error?: string;
  magicLinkEnabled: boolean;
}) {
  const [state, action] = useActionState<MagicLinkState, FormData>(requestMagicLink, {});

  return (
    <div className="bg-card rounded-xl border p-6 shadow-[var(--shadow-soft)] sm:p-8">
      <AnimatePresence mode="wait" initial={false}>
        {sent ? (
          <motion.div
            key="sent"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="text-center"
            role="status"
          >
            <div className="bg-brand/10 text-brand mx-auto mb-4 flex size-12 items-center justify-center rounded-full">
              <MailCheck className="size-6" aria-hidden />
            </div>
            <h1 className="text-lg font-semibold">{authCopy.sentTitle}</h1>
            <p className="text-muted-foreground mt-2">{authCopy.sentBody}</p>
            <p className="text-muted-foreground mt-4 text-xs">{authCopy.sentHint}</p>
            <Button asChild variant="ghost" className="mt-6">
              <Link href={`/connexion?callbackUrl=${encodeURIComponent(callbackUrl)}`}>
                {authCopy.sentBack}
              </Link>
            </Button>
          </motion.div>
        ) : (
          <motion.div
            key="form"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
          >
            <h1 className="text-lg font-semibold">{authCopy.title}</h1>
            <p className="text-muted-foreground mt-1">{authCopy.subtitle}</p>

            {error && (
              <div
                role="alert"
                className="border-destructive/30 bg-destructive/5 text-destructive mt-5 flex gap-2 rounded-lg border p-3 text-sm"
              >
                <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
                <p>{error}</p>
              </div>
            )}

            <form action={signInWithGoogle} className="mt-6">
              <input type="hidden" name="callbackUrl" value={callbackUrl} />
              <GoogleButton />
              <p className="text-muted-foreground mt-2 text-xs">{authCopy.googleHint}</p>
            </form>

            {magicLinkEnabled && (
              <>
                <div className="text-muted-foreground my-6 flex items-center gap-3 text-xs">
                  <span className="bg-border h-px flex-1" />
                  {authCopy.or}
                  <span className="bg-border h-px flex-1" />
                </div>

                <form action={action} noValidate>
                  <input type="hidden" name="callbackUrl" value={callbackUrl} />
                  <Label htmlFor="email">{authCopy.emailLabel}</Label>
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    inputMode="email"
                    required
                    defaultValue={state.email}
                    placeholder={authCopy.emailPlaceholder}
                    aria-invalid={state.error ? true : undefined}
                    aria-describedby={state.error ? "email-error" : "email-hint"}
                    className="mt-2 h-10"
                  />
                  {state.error ? (
                    <p id="email-error" role="alert" className="text-destructive mt-2 text-xs">
                      {state.error}
                    </p>
                  ) : (
                    <p id="email-hint" className="text-muted-foreground mt-2 text-xs">
                      {authCopy.emailHint}
                    </p>
                  )}
                  <MagicLinkButton />
                </form>
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function GoogleButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="outline" className="h-10 w-full gap-2" disabled={pending}>
      {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <GoogleIcon />}
      {authCopy.google}
    </Button>
  );
}

function MagicLinkButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" className="mt-4 h-10 w-full" disabled={pending}>
      {pending && <Loader2 className="size-4 animate-spin" aria-hidden />}
      {pending ? authCopy.sending : authCopy.emailSubmit}
    </Button>
  );
}

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-4" aria-hidden>
      <path
        fill="#4285F4"
        d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.5a5.6 5.6 0 0 1-2.4 3.6v3h3.9c2.3-2.1 3.5-5.2 3.5-8.8Z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.2 0 6-1.1 7.9-2.9l-3.9-3c-1.1.7-2.4 1.2-4 1.2-3.1 0-5.7-2.1-6.6-4.9H1.4v3.1A12 12 0 0 0 12 24Z"
      />
      <path fill="#FBBC05" d="M5.4 14.4a7.2 7.2 0 0 1 0-4.7V6.6h-4a12 12 0 0 0 0 10.8l4-3Z" />
      <path
        fill="#EA4335"
        d="M12 4.8c1.8 0 3.3.6 4.6 1.8l3.4-3.4A12 12 0 0 0 1.4 6.6l4 3.1C6.3 6.9 8.9 4.8 12 4.8Z"
      />
    </svg>
  );
}
