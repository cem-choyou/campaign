// Manual check that the structured-output schemas of src/server/ai are accepted by the real model
// (a few cents): npx tsx scripts/ai-schemas-smoke.ts. Schemas copied here because the server
// modules import "server-only".
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";

process.loadEnvFile(".env.local");
const model = process.env.AI_MODEL ?? "claude-sonnet-5";
const workspace = process.env.ANTHROPIC_WORKSPACE_ID;
const client = new Anthropic({
  defaultHeaders: workspace ? { "anthropic-workspace-id": workspace } : undefined,
});

const FIELDS = [
  "ignore",
  "week",
  "day",
  "account",
  "network",
  "content",
  "status",
  "contentMedia",
] as const;
const FORMATS = ["VIDEO_POST", "SHORT", "LONG_VIDEO", "IMAGE", "DOCUMENT", "TEXT"] as const;

const schemas = {
  mapping: z.object({
    columns: z.array(z.object({ column: z.number().int(), field: z.enum(FIELDS) })),
  }),
  interpretation: z.object({
    contents: z.array(
      z.object({
        value: z.string(),
        code: z.string(),
        type: z.enum(["LONG_VIDEO", "CAPSULE", "SHORT", "IMAGE", "DOCUMENT"]),
        title: z.string(),
        format: z.enum(FORMATS).nullable(),
        linkToCode: z.string().nullable(),
      }),
    ),
    accounts: z.array(z.object({ value: z.string(), match: z.string().nullable() })),
  }),
  planning: z.object({
    posts: z.array(
      z.object({
        week: z.number().int().min(1).max(52),
        day: z.number().int().min(0).max(6),
        time: z.string(),
        account: z.string().min(1).max(120),
        format: z.enum(FORMATS),
        contentCode: z.string().max(30).nullable(),
        angle: z.string(),
      }),
    ),
  }),
};

const prompts: Record<keyof typeof schemas, string> = {
  mapping:
    "Colonnes : 0: Semaine | 1: Jour | 2: Canal | 3: Compte | 4: Format | 5: Statut | 6: Lien de publication / Notes\nLigne : Semaine 1 | Lundi | LinkedIn | ITforBusiness | Capsule 1 | À faire | https://next.frame.io/x\nAssociez chaque colonne à un champ (content = le contenu publié comme « Capsule 1 »).",
  interpretation:
    "Comptes : IT for Business (LinkedIn), IT for Business YouTube (YouTube), Anne Laure (LinkedIn).\nComptes à rapprocher : « Shorts » (réseau : YouTube), « ITforBusiness » (réseau : LinkedIn).\nContenus : « Capsule 1 », « Short 1 (Renvoi vers longue vidéo) ».",
  planning:
    "Proposez 2 semaines de planning (2 à 3 posts par semaine) pour la campagne « Promotion vidéo LDDLT ». Comptes : IT for Business (LinkedIn), IT for Business YouTube (YouTube). Contenus : CAP1, CAP2, SHORT1. Jours 0 = lundi.",
};

async function main() {
  for (const [name, schema] of Object.entries(schemas) as [keyof typeof schemas, z.ZodType][]) {
    const started = Date.now();
    try {
      const response = await client.messages.parse({
        model,
        max_tokens: 16000,
        system: "Répondez uniquement avec le JSON demandé.",
        messages: [{ role: "user", content: prompts[name] }],
        output_config: { effort: "low", format: zodOutputFormat(schema) },
      });
      console.log(`\n--- ${name} (${Date.now() - started} ms, stop=${response.stop_reason})`);
      console.log(JSON.stringify(response.parsed_output, null, 1).slice(0, 1500));
    } catch (e) {
      console.log(
        `\n--- ${name} FAILED`,
        e instanceof Anthropic.APIError ? `${e.status} ${e.message}` : e,
      );
    }
  }
}

void main();
