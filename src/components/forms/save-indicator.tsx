"use client";

import { AlertCircle, Check, Loader2 } from "lucide-react";
import { common } from "@/lib/copy/common";
import { cn } from "@/lib/utils";
import type { SaveStatus } from "./use-autosave";

/** Discreet « Enregistré » indicator (§8.1). */
export function SaveIndicator({
  status,
  error,
  className,
}: {
  status: SaveStatus;
  error?: string | null;
  className?: string;
}) {
  if (status === "idle") return <span className={className} aria-live="polite" />;
  return (
    <span
      aria-live="polite"
      className={cn(
        "text-muted-foreground inline-flex items-center gap-1.5 text-xs",
        status === "error" && "text-destructive",
        className,
      )}
    >
      {status === "saved" && <Check className="size-3.5" aria-hidden />}
      {(status === "saving" || status === "pending") && (
        <Loader2 className="size-3.5 animate-spin" aria-hidden />
      )}
      {status === "error" && <AlertCircle className="size-3.5" aria-hidden />}
      {status === "saved"
        ? common.saving.saved
        : status === "error"
          ? (error ?? common.saving.error)
          : common.saving.saving}
    </span>
  );
}
