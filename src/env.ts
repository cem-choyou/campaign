import "server-only";
import { z } from "zod";

// Server environment, validated once at startup (§17). Variables for later lots stay optional
// until their lot ships; the app refuses to start when a required one is missing.

const optional = z
  .string()
  .trim()
  .transform((v) => (v === "" ? undefined : v))
  .optional();

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),

  AUTH_URL: z.url(),
  AUTH_SECRET: z.string().min(32, "AUTH_SECRET doit contenir au moins 32 caractères"),
  AUTH_GOOGLE_ID: z.string().min(1),
  AUTH_GOOGLE_SECRET: z.string().min(1),
  ALLOWED_GOOGLE_DOMAIN: z.string().min(1).default("choyou.fr"),

  DATABASE_URL: z.string().min(1),
  DIRECT_URL: optional,

  RESEND_API_KEY: optional,
  EMAIL_FROM: z.string().min(1).default("Campaign · ChoYou <campaign@choyou.fr>"),
  /** "log" prints e-mails instead of sending them (local e2e only, never in production). */
  EMAIL_TRANSPORT: z.enum(["resend", "log"]).default("resend"),

  /** Optional at startup: AI features explain themselves when it is missing. */
  ANTHROPIC_API_KEY: optional,
  /** Only for an organization key not scoped to a workspace (sent as anthropic-workspace-id). */
  ANTHROPIC_WORKSPACE_ID: optional,
  AI_MODEL: z.string().trim().min(1).default("claude-sonnet-5"),
  AI_DAILY_LIMIT_PER_BRAND: z.coerce.number().int().positive().default(300),
  /** "mock" returns canned texts instead of calling the model (local e2e only, never in production). */
  AI_TRANSPORT: z.enum(["anthropic", "mock"]).default("anthropic"),

  N8N_API_TOKEN: optional,
  N8N_VALIDATION_WEBHOOK_URL: optional,
  KIT_SIGNING_SECRET: optional,
  ENCRYPTION_KEY: optional,
});

export type Env = z.infer<typeof schema>;

export function parseEnv(source: Record<string, string | undefined>): Env {
  const result = schema.safeParse(source);
  if (!result.success) {
    const lines = result.error.issues.map((i) => `  - ${i.path.join(".")}: ${i.message}`);
    throw new Error(
      `Configuration invalide : variables d'environnement manquantes ou incorrectes.\n${lines.join("\n")}\nVoir .env.example.`,
    );
  }
  return result.data;
}

export const env = parseEnv(process.env);

if (env.EMAIL_TRANSPORT === "log" && env.AUTH_URL.startsWith("https://")) {
  throw new Error("EMAIL_TRANSPORT=log est réservé aux tests locaux (AUTH_URL en https).");
}
if (env.AI_TRANSPORT === "mock" && env.AUTH_URL.startsWith("https://")) {
  throw new Error("AI_TRANSPORT=mock est réservé aux tests locaux (AUTH_URL en https).");
}
