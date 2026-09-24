import "server-only";
import { env } from "@/env";
import type { AiTask } from "./client";

/** What `Post.aiPromptUsed` keeps: enough to know where a text came from (§10.3). */
export function aiPromptRecord(task: AiTask, extra: Record<string, unknown> = {}) {
  return { task, model: env.AI_MODEL, at: new Date().toISOString(), ...extra };
}
