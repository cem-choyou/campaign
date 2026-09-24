// Manual smoke test of the real model (a few cents): npx tsx scripts/ai-smoke.ts
// Uses the same request shape as src/server/ai/client.ts. Not part of the test suite.
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import { brandSystemPrompt, writePostPrompt, youtubeMetaPrompt } from "../src/server/ai/prompt";

process.loadEnvFile(".env.local");
const model = process.env.AI_MODEL ?? "claude-sonnet-5";
const workspace = process.env.ANTHROPIC_WORKSPACE_ID;
const client = new Anthropic({
  defaultHeaders: workspace ? { "anthropic-workspace-id": workspace } : undefined,
});

const brand = {
  name: "IT for Business",
  editorialLine:
    "Décrypter la transformation numérique des entreprises pour les décideurs IT, avec des témoignages concrets.",
  tone: "Expert mais accessible, concret, chaleureux. Vouvoiement. Pas de jargon marketing.",
  dos: "Commencer par une accroche forte. Citer des faits et des chiffres. Mettre en avant les témoignages.",
  donts: "Pas de superlatifs creux, pas de promesses vagues, pas plus de deux emojis.",
  examplePosts: [],
  hashtags: ["ITforBusiness", "DSI", "TransformationNumérique"],
  defaultCta: "Regardez la vidéo complète.",
  mentionHandle: "IT for Business",
  extraInstructions: null,
};
const input = {
  brand,
  campaign: {
    name: "Promotion vidéo LDDLT",
    objective: "Faire connaître la vidéo LDDLT auprès des DSI.",
    audience: "DSI et responsables IT d'entreprises de 200 à 2 000 salariés.",
    brief: null,
    keyMessage: "La transformation numérique réussit quand les équipes métier sont impliquées.",
    callToAction: "Regarder la vidéo complète sur YouTube.",
    period: "du 5 oct. 2026 au 13 nov. 2026",
    mainContent: { code: "VID-LONG", title: "Vidéo longue LDDLT", summary: null },
  },
  content: {
    code: "CAP1",
    type: "CAPSULE" as const,
    title: "Capsule 1",
    summary: null,
    durationSec: null,
    youtubeUrl: null,
  },
  post: {
    platform: "LINKEDIN" as const,
    format: "VIDEO_POST" as const,
    day: "lundi 5 octobre",
    publisher: { kind: "account" as const, name: "IT for Business" },
    angle: null,
    linkTo: null,
  },
};

async function main() {
  console.log(`model=${model}, system prompt ${brandSystemPrompt(brand).length} chars`);
  const p = writePostPrompt(input);
  const started = Date.now();
  const stream = client.messages.stream({
    model,
    max_tokens: 16000,
    system: [{ type: "text", text: p.system, cache_control: { type: "ephemeral" } }],
    messages: [{ role: "user", content: p.user }],
    output_config: { effort: "medium" },
  });
  let first = 0;
  stream.on("text", () => {
    if (!first) first = Date.now() - started;
  });
  const msg = await stream.finalMessage();
  const text = msg.content.flatMap((b) => (b.type === "text" ? [b.text] : [])).join("");
  console.log(
    `\n--- LinkedIn (first text ${first} ms, total ${Date.now() - started} ms, stop=${msg.stop_reason})`,
  );
  console.log(text);
  console.log("usage", msg.usage);

  const yt = youtubeMetaPrompt({
    ...input,
    content: { ...input.content, code: "SHORT1", type: "SHORT" as const, title: "Short 1" },
    post: {
      ...input.post,
      platform: "YOUTUBE" as const,
      format: "SHORT" as const,
      publisher: { kind: "account" as const, name: "IT for Business YouTube" },
      linkTo: { title: "Vidéo longue LDDLT", url: null },
    },
  });
  const parsed = await client.messages.parse({
    model,
    max_tokens: 16000,
    system: [{ type: "text", text: yt.system, cache_control: { type: "ephemeral" } }],
    messages: [{ role: "user", content: yt.user }],
    output_config: {
      effort: "medium",
      format: zodOutputFormat(
        z.object({ title: z.string(), description: z.string(), tags: z.array(z.string()) }),
      ),
    },
  });
  console.log(`\n--- Short (stop=${parsed.stop_reason})`);
  console.log(parsed.parsed_output);
  console.log("usage", parsed.usage);
}

main().catch((e) => {
  console.error("FAILED", e instanceof Anthropic.APIError ? `${e.status} ${e.message}` : e);
  process.exit(1);
});
