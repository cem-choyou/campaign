import { describe, expect, it } from "vitest";
import {
  type PostPromptInput,
  VARIANT_HOOKS,
  brandSystemPrompt,
  channelRules,
  cleanOutput,
  rewritePrompt,
  writePostPrompt,
} from "@/server/ai/prompt";

const brand = {
  name: "IT for Business",
  editorialLine: "Décrypter la transformation numérique pour les DSI.",
  tone: "Expert mais accessible. Vouvoiement.",
  dos: "Citer des faits.",
  donts: "Pas d'emoji.",
  examplePosts: [{ body: "Un exemple de post.", note: "très lu" }],
  hashtags: ["ITforBusiness", "#DSI"],
  defaultCta: "Regardez la vidéo complète.",
  mentionHandle: "@IT for Business",
  extraInstructions: null,
};

const input: PostPromptInput = {
  brand,
  campaign: {
    name: "Promotion vidéo LDDLT",
    objective: "Faire voir la vidéo aux DSI.",
    audience: "DSI",
    brief: null,
    keyMessage: "Impliquer les métiers.",
    callToAction: null,
    period: "du 5 oct. 2026 au 13 nov. 2026",
    mainContent: { code: "VID-LONG", title: "Vidéo longue LDDLT", summary: null },
  },
  content: {
    code: "CAP1",
    type: "CAPSULE",
    title: "Capsule 1",
    summary: "Trois DSI témoignent.",
    durationSec: 95,
    youtubeUrl: null,
  },
  post: {
    platform: "LINKEDIN",
    format: "VIDEO_POST",
    day: "lundi 5 octobre",
    publisher: { kind: "account", name: "IT for Business" },
    angle: "Le rôle des équipes métier",
    linkTo: null,
  },
};

describe("AI prompt", () => {
  it("puts the brand in the system prompt, in the §10.1 order", () => {
    const system = brandSystemPrompt(brand);
    const order = ["## Ligne éditoriale", "## Ton", "## À faire", "## À éviter", "## Repères"];
    const positions = order.map((h) => system.indexOf(h));
    expect(positions.every((p) => p >= 0)).toBe(true);
    expect([...positions].sort((a, b) => a - b)).toEqual(positions);
    expect(system).toContain("#ITforBusiness #DSI");
    expect(system).toContain("@IT for Business");
    expect(system).toContain("Un exemple de post.");
    expect(system).not.toContain("Instructions supplémentaires");
  });

  it("keeps post-specific data out of the system prompt (cache stays per brand)", () => {
    const prompt = writePostPrompt(input);
    expect(prompt.system).not.toContain("Capsule 1");
    expect(prompt.user).toContain("## Campagne");
    expect(prompt.user.indexOf("## Campagne")).toBeLessThan(prompt.user.indexOf("## Contenu"));
    expect(prompt.user.indexOf("## Contenu")).toBeLessThan(prompt.user.indexOf("## Publication"));
    expect(prompt.user).toContain("Durée : 1 min 35 s");
    expect(prompt.user).toContain("Sujet / angle : Le rôle des équipes métier");
  });

  it("applies the channel rules", () => {
    expect(channelRules("LINKEDIN", "VIDEO_POST")).toMatch(/600 à 1 300/);
    expect(channelRules("YOUTUBE", "SHORT")).toMatch(/#Shorts/);
    expect(channelRules("YOUTUBE", "LONG_VIDEO")).toMatch(/5 à 10 tags/);
  });

  it("writes in the contributor's voice when they publish from their profile", () => {
    const prompt = writePostPrompt({
      ...input,
      post: {
        ...input.post,
        publisher: {
          kind: "contributor",
          person: { firstName: "Anne Laure", jobTitle: "DSI", toneNote: "direct", samplePosts: [] },
        },
      },
    });
    expect(prompt.user).toContain("## Auteur : Anne Laure");
    expect(prompt.user).toContain("première personne");
  });

  it("gives each variant a different hook, and rewrites carry the current text", () => {
    const a = writePostPrompt(input, VARIANT_HOOKS[0]).user;
    const b = writePostPrompt(input, VARIANT_HOOKS[1]).user;
    expect(a).not.toBe(b);
    const rewrite = rewritePrompt(input, "Texte actuel.", "Plus court.");
    expect(rewrite.user).toContain("Texte actuel.");
    expect(rewrite.user).toContain("Plus court.");
  });

  it("cleans the usual wrappers around a model answer", () => {
    expect(cleanOutput('"Bonjour à tous"')).toBe("Bonjour à tous");
    expect(cleanOutput("« Bonjour »")).toBe("Bonjour");
    expect(cleanOutput("```\nTexte\n```")).toBe("Texte");
    expect(cleanOutput("Voici une proposition :\n\nTexte du post")).toBe("Texte du post");
    // Quotes inside the text are kept.
    expect(cleanOutput('"A" et "B"')).toBe('"A" et "B"');
  });
});
