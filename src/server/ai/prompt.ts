// Pure prompt assembly (CLAUDE.md §10). The system prompt only depends on the brand, so it stays
// identical across the posts of a brand; the post-specific context goes in the user message.

import { contentTypeLabels, postFormatLabels } from "@/lib/copy/common";
import type { Platform, PostFormat } from "@/lib/posts";

export type ExamplePost = { body: string; note?: string };

export type BrandPrompt = {
  name: string;
  editorialLine: string;
  tone: string;
  dos: string;
  donts: string;
  examplePosts: ExamplePost[];
  hashtags: string[];
  defaultCta: string | null;
  mentionHandle: string | null;
  extraInstructions: string | null;
};

export type CampaignContext = {
  name: string;
  objective: string | null;
  audience: string | null;
  brief: string | null;
  keyMessage: string | null;
  callToAction: string | null;
  /** Human-readable dates, e.g. « du lun. 5 oct. au ven. 13 nov. ». */
  period: string | null;
  mainContent: { code: string; title: string; summary: string | null } | null;
};

export type ContentContext = {
  code: string;
  type: keyof typeof contentTypeLabels;
  title: string;
  summary: string | null;
  durationSec: number | null;
  youtubeUrl: string | null;
};

export type ContributorContext = {
  firstName: string;
  jobTitle: string | null;
  toneNote: string | null;
  samplePosts: ExamplePost[];
};

export type PostContext = {
  platform: Platform;
  format: PostFormat;
  /** « mercredi 7 octobre ». */
  day: string;
  /** Account name, or the contributor when they publish from their own profile. */
  publisher:
    { kind: "account"; name: string } | { kind: "contributor"; person: ContributorContext };
  angle: string | null;
  linkTo: { title: string; url: string | null } | { title: null; url: string } | null;
};

export type PostPromptInput = {
  brand: BrandPrompt;
  campaign: CampaignContext;
  content: ContentContext | null;
  post: PostContext;
};

export type Prompt = { system: string; user: string };

// ---------- Helpers ----------

function section(title: string, lines: (string | null | undefined | false)[]): string {
  const body = lines.filter((l): l is string => typeof l === "string" && l.trim() !== "");
  return body.length ? `## ${title}\n${body.join("\n")}` : "";
}

function field(label: string, value: string | null | undefined): string | null {
  const v = value?.trim();
  return v ? `- ${label} : ${v}` : null;
}

function examples(list: ExamplePost[], max = 3): string | null {
  const items = list.filter((e) => e.body.trim()).slice(0, max);
  if (!items.length) return null;
  return items
    .map(
      (e, i) =>
        `Exemple ${i + 1}${e.note ? ` (${e.note.trim()})` : ""} :\n"""\n${e.body.trim()}\n"""`,
    )
    .join("\n\n");
}

function duration(sec: number | null): string | null {
  if (!sec) return null;
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return m ? `${m} min${s ? ` ${s} s` : ""}` : `${s} s`;
}

function join(parts: string[]): string {
  return parts.filter(Boolean).join("\n\n");
}

// ---------- Channel rules (§10.2), overridden by the brand's own instructions ----------

export function channelRules(platform: Platform, format: PostFormat): string {
  if (platform === "YOUTUBE" && format === "SHORT") {
    return [
      "- Titre de 70 caractères maximum, percutant, qui donne envie de regarder.",
      "- Description courte : une ou deux phrases, puis #Shorts, puis le lien de la vidéo longue s'il est fourni.",
    ].join("\n");
  }
  if (platform === "YOUTUBE") {
    return [
      "- Titre de 70 caractères maximum, clair et incitatif.",
      "- Description structurée : un résumé de 2 ou 3 phrases, les chapitres s'ils sont fournis, puis les liens utiles.",
      "- 5 à 10 tags pertinents.",
    ].join("\n");
  }
  return [
    "- Accroche forte dans les deux premières lignes : c'est tout ce qui est visible avant « …voir plus ».",
    "- Paragraphes courts, une idée par paragraphe, lignes aérées.",
    "- Longueur cible : 600 à 1 300 caractères.",
    "- Un seul appel à l'action.",
    "- Pas de lien externe dans le texte (il sera ajouté en commentaire), sauf demande explicite.",
    "- 3 à 5 hashtags à la fin.",
  ].join("\n");
}

// ---------- System prompt: the brand (stable, cache-friendly) ----------

export function brandSystemPrompt(brand: BrandPrompt): string {
  return join([
    `Vous êtes le rédacteur des réseaux sociaux de la marque « ${brand.name} ». Vous écrivez en français, pour des publications LinkedIn et YouTube.`,
    section("Ligne éditoriale", [brand.editorialLine]),
    section("Ton", [brand.tone]),
    section("À faire", [brand.dos]),
    section("À éviter (à respecter strictement, y compris sur les emojis)", [brand.donts]),
    section("Repères de la marque", [
      brand.hashtags.length
        ? `- Hashtags de la marque : ${brand.hashtags.map((h) => `#${h.replace(/^#/, "")}`).join(" ")}`
        : null,
      field("Appel à l'action par défaut", brand.defaultCta),
      field(
        "Compte à mentionner",
        brand.mentionHandle ? `@${brand.mentionHandle.replace(/^@/, "")}` : null,
      ),
    ]),
    section("Exemples de publications de la marque (pour le style, ne pas recopier)", [
      examples(brand.examplePosts),
    ]),
    section("Instructions supplémentaires", [brand.extraInstructions]),
    section("Règles de sortie", [
      "- Répondez uniquement avec le texte demandé : pas d'introduction, pas de commentaire, pas de guillemets autour du texte, pas de titre en Markdown.",
      "- N'inventez ni chiffre, ni citation, ni nom : utilisez seulement les informations fournies.",
      "- Les codes et titres internes des contenus (CAP1, « Capsule 1 », « Short 2 ») servent au repérage : ne les citez jamais tels quels, parlez de ce que montre le contenu.",
      "- Les consignes de la marque priment sur les règles générales par canal.",
    ]),
  ]);
}

// ---------- User message: campaign, content, post, contributor ----------

export function postContext(input: PostPromptInput): string {
  const { campaign, content, post } = input;
  const person = post.publisher.kind === "contributor" ? post.publisher.person : null;
  return join([
    section("Campagne", [
      field("Nom", campaign.name),
      field("Objectif", campaign.objective),
      field("Cible", campaign.audience),
      field("Message clé", campaign.keyMessage),
      field("Appel à l'action de la campagne", campaign.callToAction),
      field("Période", campaign.period),
      field("Brief", campaign.brief),
      campaign.mainContent
        ? field(
            "Contenu principal",
            `${campaign.mainContent.title}${campaign.mainContent.summary ? ` — ${campaign.mainContent.summary}` : ""}`,
          )
        : null,
    ]),
    content
      ? section("Contenu publié avec ce post", [
          field("Type", contentTypeLabels[content.type]),
          field("Titre", content.title),
          field("Durée", duration(content.durationSec)),
          field("Résumé / message clé", content.summary),
          field("Lien YouTube", content.youtubeUrl),
        ])
      : "",
    section("Publication", [
      field("Réseau", post.platform === "LINKEDIN" ? "LinkedIn" : "YouTube"),
      field("Format", postFormatLabels[post.format]),
      field("Date", post.day),
      post.publisher.kind === "account"
        ? field("Publié par", `le compte « ${post.publisher.name} »`)
        : field("Publié par", `${post.publisher.person.firstName}, depuis son profil personnel`),
      field("Sujet / angle", post.angle),
      post.linkTo
        ? field("Renvoie vers", [post.linkTo.title, post.linkTo.url].filter(Boolean).join(" — "))
        : null,
    ]),
    person
      ? section(`Auteur : ${person.firstName}`, [
          "- Écrivez à la première personne, comme si cette personne publiait elle-même : un texte personnel, jamais une copie du post de la page.",
          field("Poste", person.jobTitle),
          field("Ton personnel", person.toneNote),
          examples(person.samplePosts, 2),
        ])
      : "",
    section("Règles pour ce canal", [channelRules(post.platform, post.format)]),
  ]);
}

// ---------- Tasks ----------

/** Angles used for « Générer 3 propositions »: each stream gets a different hook. */
export const VARIANT_HOOKS = [
  "Ouvrez par une question qui interpelle la cible.",
  "Ouvrez par un fait, un chiffre ou un constat fourni dans le contexte.",
  "Ouvrez par une situation concrète ou un témoignage tiré du contexte.",
] as const;

export function writePostPrompt(input: PostPromptInput, hook?: string): Prompt {
  return {
    system: brandSystemPrompt(input.brand),
    user: join([
      postContext(input),
      `Rédigez le texte de cette publication${input.post.platform === "YOUTUBE" ? " (la description de la vidéo)" : ""}.${hook ? ` ${hook}` : ""}`,
    ]),
  };
}

export const QUICK_ACTIONS = {
  shorter: "Raccourcissez ce texte d'environ un tiers en gardant l'accroche et l'appel à l'action.",
  punchier:
    "Rendez ce texte plus percutant : accroche plus forte, phrases plus nerveuses, sans exagération.",
  addCta: "Ajoutez un appel à l'action clair (un seul), cohérent avec la campagne.",
  newHook:
    "Réécrivez uniquement l'accroche (les deux premières lignes) ; gardez le reste presque identique.",
  lessFormal:
    "Rendez le ton un peu moins formel, plus direct et humain, en gardant le vouvoiement.",
} as const;

export type QuickAction = keyof typeof QUICK_ACTIONS;

export function rewritePrompt(
  input: PostPromptInput,
  current: string,
  instruction: string,
): Prompt {
  return {
    system: brandSystemPrompt(input.brand),
    user: join([
      postContext(input),
      `## Texte actuel\n"""\n${current.trim()}\n"""`,
      `## Modification demandée\n${instruction.trim()}`,
      "Renvoyez le texte complet modifié.",
    ]),
  };
}

export function youtubeMetaPrompt(input: PostPromptInput): Prompt {
  return {
    system: brandSystemPrompt(input.brand),
    user: join([
      postContext(input),
      "Proposez le titre, la description et les tags de cette vidéo YouTube, en respectant les règles du canal.",
    ]),
  };
}

// ---------- Output cleanup ----------

/** Removes what models sometimes add around a text: code fences, wrapping quotes, « Voici… : ». */
export function cleanOutput(text: string): string {
  let t = text.trim();
  t = t
    .replace(/^```[a-z]*\n?/i, "")
    .replace(/\n?```$/, "")
    .trim();
  t = t.replace(/^(voici|voilà)[^\n]{0,80}:\s*\n+/i, "").trim();
  const pairs: [string, string][] = [
    ['"', '"'],
    ["«", "»"],
    ["“", "”"],
  ];
  for (const [open, close] of pairs) {
    if (t.startsWith(open) && t.endsWith(close) && t.length > 2) {
      const inner = t.slice(open.length, -close.length);
      if (!inner.includes(open) && !inner.includes(close)) t = inner.trim();
    }
  }
  return t;
}
