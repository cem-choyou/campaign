import "server-only";
import { env } from "@/env";
import { common } from "@/lib/copy/common";
import { AppError, type AppErrorCode } from "@/server/errors";
import { logger } from "@/server/logger";

// Helpers for the app's own route handlers (streaming AI, uploads, downloads). Server Actions keep
// using runAction; routes are only used where an action cannot stream or take a large file.

const STATUS: Record<AppErrorCode, number> = {
  UNAUTHENTICATED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  INVALID: 400,
  CONFLICT: 409,
  UNAVAILABLE: 503,
};

export function errorResponse(error: unknown, event: string): Response {
  if (error instanceof AppError) {
    return Response.json({ error: error.message }, { status: STATUS[error.code] });
  }
  logger.error(event, { error: error instanceof Error ? error.message : String(error) });
  return Response.json({ error: common.errors.generic }, { status: 500 });
}

/**
 * Plain UTF-8 streaming response from a text generator. The first chunk is pulled before
 * answering, so early failures (quota, configuration) still get a proper JSON status; a failure
 * mid-stream aborts the response.
 */
export async function textStreamResponse(
  iterator: AsyncGenerator<string, string>,
): Promise<Response> {
  const first = await iterator.next();
  const encoder = new TextEncoder();
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      if (!first.done) controller.enqueue(encoder.encode(first.value));
      else controller.close();
    },
    async pull(controller) {
      try {
        const next = await iterator.next();
        if (next.done) controller.close();
        else controller.enqueue(encoder.encode(next.value));
      } catch (error) {
        controller.error(error);
      }
    },
    async cancel() {
      await iterator.return("");
    },
  });
  return new Response(body, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

/**
 * Same-origin check for cookie-authenticated POST routes (defence in depth on top of SameSite=Lax):
 * browsers always send Origin on POST fetches.
 */
export function assertSameOrigin(request: Request): void {
  const origin = request.headers.get("origin");
  const allowed = new URL(env.AUTH_URL).origin;
  const self = new URL(request.url).origin;
  if (!origin || (origin !== allowed && origin !== self)) throw new AppError("FORBIDDEN");
}
