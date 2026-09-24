import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import type { z } from "zod";
import { env } from "@/env";
import { aiCopy } from "@/lib/copy/ai";
import { AppError } from "@/server/errors";
import { logger } from "@/server/logger";
import { type Prompt, cleanOutput } from "./prompt";

// The only module that talks to the model provider (Claude through the official SDK). Swapping
// providers means rewriting this file only. `AI_TRANSPORT=mock` returns the caller's canned output
// (e2e tests), streamed in small chunks like the real thing.

export type Effort = "low" | "medium" | "high";

/** Operation name, for logs and `Post.aiPromptUsed`. */
export type AiTask =
  | "post.write"
  | "post.variant"
  | "post.rewrite"
  | "post.youtube"
  | "brand.sandbox"
  | "campaign.planning"
  | "campaign.brief"
  | "import.mapping";

type Options = { task: AiTask; effort?: Effort; signal?: AbortSignal };

const MAX_TOKENS = 16_000;

let client: Anthropic | null = null;

function getClient(): Anthropic {
  if (!env.ANTHROPIC_API_KEY) throw new AppError("UNAVAILABLE", aiCopy.errors.notConfigured);
  client ??= new Anthropic({ apiKey: env.ANTHROPIC_API_KEY, maxRetries: 2, timeout: 120_000 });
  return client;
}

export function isMock(): boolean {
  return env.AI_TRANSPORT === "mock";
}

/** Converts provider errors into messages the user can act on; never leaks provider details. */
export function toAppError(error: unknown, task: AiTask): AppError {
  if (error instanceof AppError) return error;
  if (error instanceof Anthropic.APIUserAbortError)
    return new AppError("CONFLICT", aiCopy.errors.failed);
  let message: string = aiCopy.errors.failed;
  if (error instanceof Anthropic.RateLimitError) message = aiCopy.errors.busy;
  else if (
    error instanceof Anthropic.AuthenticationError ||
    error instanceof Anthropic.PermissionDeniedError
  ) {
    message = aiCopy.errors.notConfigured;
  } else if (error instanceof Anthropic.InternalServerError) message = aiCopy.errors.busy;
  logger.error("ai.failed", {
    task,
    status: error instanceof Anthropic.APIError ? error.status : undefined,
    error: error instanceof Error ? error.name : String(error),
  });
  return new AppError("UNAVAILABLE", message);
}

function params(prompt: Prompt, effort: Effort) {
  return {
    model: env.AI_MODEL,
    max_tokens: MAX_TOKENS,
    // Stable per brand: cached across the posts of one brand.
    system: [
      { type: "text" as const, text: prompt.system, cache_control: { type: "ephemeral" as const } },
    ],
    messages: [{ role: "user" as const, content: prompt.user }],
    output_config: { effort },
  };
}

function* chunks(text: string, size = 24) {
  for (let i = 0; i < text.length; i += size) yield text.slice(i, i + size);
}

/** Streams a text: yields the deltas as they arrive and returns the cleaned full text. */
export async function* streamText(
  prompt: Prompt,
  options: Options & { mock: () => string },
): AsyncGenerator<string, string> {
  const started = Date.now();
  if (isMock()) {
    const text = options.mock();
    for (const piece of chunks(text)) {
      if (options.signal?.aborted) break;
      await new Promise((r) => setTimeout(r, 15));
      yield piece;
    }
    return text;
  }

  let full = "";
  try {
    const stream = getClient().messages.stream(params(prompt, options.effort ?? "medium"), {
      signal: options.signal,
    });
    for await (const event of stream) {
      if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
        full += event.delta.text;
        yield event.delta.text;
      }
    }
    const message = await stream.finalMessage();
    if (message.stop_reason === "refusal") throw new AppError("UNAVAILABLE", aiCopy.errors.refused);
    logger.info("ai.done", {
      task: options.task,
      ms: Date.now() - started,
      inputTokens: message.usage.input_tokens,
      cachedTokens: message.usage.cache_read_input_tokens,
      outputTokens: message.usage.output_tokens,
    });
  } catch (error) {
    throw toAppError(error, options.task);
  }
  const text = cleanOutput(full);
  if (!text) throw new AppError("UNAVAILABLE", aiCopy.errors.empty);
  return text;
}

/** Collects a whole streamed text (bulk writing, server-side use). */
export async function generateText(
  prompt: Prompt,
  options: Options & { mock: () => string },
): Promise<string> {
  const iterator = streamText(prompt, options);
  let result = await iterator.next();
  while (!result.done) result = await iterator.next();
  return cleanOutput(result.value);
}

/** Structured output validated by a Zod schema (variants, planning, column mapping, brief). */
export async function generateObject<S extends z.ZodType>(
  prompt: Prompt,
  schema: S,
  options: Options & { mock: () => z.infer<S> },
): Promise<z.infer<S>> {
  if (isMock()) return schema.parse(options.mock());
  const started = Date.now();
  try {
    const response = await getClient().messages.parse(
      {
        ...params(prompt, options.effort ?? "medium"),
        output_config: {
          effort: options.effort ?? "medium",
          format: zodOutputFormat(schema),
        },
      },
      { signal: options.signal },
    );
    if (response.stop_reason === "refusal")
      throw new AppError("UNAVAILABLE", aiCopy.errors.refused);
    logger.info("ai.done", {
      task: options.task,
      ms: Date.now() - started,
      inputTokens: response.usage.input_tokens,
      cachedTokens: response.usage.cache_read_input_tokens,
      outputTokens: response.usage.output_tokens,
    });
    const parsed = schema.safeParse(response.parsed_output);
    if (!parsed.success) throw new AppError("UNAVAILABLE", aiCopy.errors.empty);
    return parsed.data;
  } catch (error) {
    throw toAppError(error, options.task);
  }
}
