import "server-only";
import type { PostPromptInput } from "./prompt";

// Deterministic outputs for AI_TRANSPORT=mock (e2e tests): readable, clearly marked as tests,
// and shaped like real answers so the UI is exercised the same way.

function subject(input: PostPromptInput): string {
  return input.content?.title ?? input.post.angle ?? input.campaign.name;
}

export function mockPost(input: PostPromptInput, variant = 0): string {
  const hooks = [
    "Et si la transformation commençait par vos équipes ?",
    "30 % de tickets en moins : c'est possible.",
    "Trois DSI racontent comment elles ont changé de méthode.",
  ];
  const cta = input.campaign.callToAction ?? input.brand.defaultCta ?? "Regardez la vidéo.";
  const tags = input.brand.hashtags
    .slice(0, 3)
    .map((h) => `#${h}`)
    .join(" ");
  return [
    hooks[variant % hooks.length],
    "",
    `[Texte de test] ${subject(input)} — ${input.post.day}.`,
    "",
    "Un paragraphe court qui développe l'idée principale de la campagne.",
    "",
    cta,
    "",
    tags,
  ]
    .join("\n")
    .trim();
}

export function mockRewrite(current: string, instruction: string): string {
  return `${current.trim()}\n\n[Modifié : ${instruction.slice(0, 40)}]`;
}

export function mockYoutube(input: PostPromptInput) {
  const short = input.post.format === "SHORT";
  return {
    title: `[Test] ${subject(input)}`.slice(0, 70),
    description: [
      `Description de test pour ${subject(input)}.`,
      short ? "#Shorts" : "",
      input.post.linkTo?.url ?? "",
    ]
      .filter(Boolean)
      .join("\n"),
    tags: ["test", "campagne", ...input.brand.hashtags.slice(0, 3)],
  };
}
