import "server-only";
import { z } from "zod";
import { common } from "@/lib/copy/common";
import { logger } from "@/server/logger";

export type AppErrorCode =
  "FORBIDDEN" | "NOT_FOUND" | "INVALID" | "CONFLICT" | "UNAUTHENTICATED" | "UNAVAILABLE";

/** Expected business error: its message is safe to show to the user. */
export class AppError extends Error {
  constructor(
    public readonly code: AppErrorCode,
    message?: string,
  ) {
    super(message ?? defaultMessage(code));
    this.name = "AppError";
  }
}

function defaultMessage(code: AppErrorCode): string {
  switch (code) {
    case "FORBIDDEN":
    case "UNAUTHENTICATED":
      return common.errors.forbidden;
    case "NOT_FOUND":
      return common.errors.notFound;
    case "INVALID":
      return common.errors.invalid;
    case "CONFLICT":
    case "UNAVAILABLE":
      return common.errors.generic;
  }
}

export type ActionResult<T = undefined> =
  { ok: true; data: T } | { ok: false; error: string; fieldErrors?: Record<string, string> };

export function ok<T>(data: T): ActionResult<T>;
export function ok(): ActionResult<undefined>;
export function ok<T>(data?: T): ActionResult<T | undefined> {
  return { ok: true, data };
}

function isNextControlFlow(error: unknown): boolean {
  // redirect() and notFound() throw special errors that must propagate.
  const digest = (error as { digest?: unknown } | null)?.digest;
  return (
    typeof digest === "string" &&
    (digest.startsWith("NEXT_REDIRECT") || digest.startsWith("NEXT_HTTP_ERROR"))
  );
}

/**
 * Standard Server Action body (§18): validates input with Zod, runs the handler and converts
 * every failure into `{ ok: false, error }` — never an unhandled exception in the UI.
 */
export async function runAction<S extends z.ZodType, T>(
  schema: S,
  input: unknown,
  handler: (data: z.infer<S>) => Promise<T>,
): Promise<ActionResult<T>> {
  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path.join(".");
      if (key && !fieldErrors[key]) fieldErrors[key] = issue.message;
    }
    return { ok: false, error: common.errors.invalid, fieldErrors };
  }
  try {
    return { ok: true, data: await handler(parsed.data) };
  } catch (error) {
    if (isNextControlFlow(error)) throw error;
    if (error instanceof AppError) return { ok: false, error: error.message };
    logger.error("action.failed", {
      error: error instanceof Error ? error.message : String(error),
    });
    return { ok: false, error: common.errors.generic };
  }
}
