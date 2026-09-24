import "server-only";
import { z } from "zod";
import { formatDateOnly } from "@/lib/dates";
import { DAYS, normalizeKey } from "@/lib/import/normalize";
import {
  type PostFormat,
  FORMATS_BY_PLATFORM,
  isComplete,
  isLocked,
  type PostStatus,
} from "@/lib/posts";
import { POST_FORMATS } from "@/lib/validations/post";
import { db } from "@/server/db";
import { AppError } from "@/server/errors";
import { generateObject } from "./client";
import { brandPromptSelect, loadCampaignContext, toBrandPrompt } from "./context";
import { type CampaignContext, brandSystemPrompt } from "./prompt";
import { consumeAi } from "./quota";

// Campaign-level AI (§8.5): brief helper, proposed planning, list of posts to write in bulk.

type Actor = { userId: string };

async function loadBrand(brandId: string) {
  return db.brand.findUniqueOrThrow({ where: { id: brandId }, select: brandPromptSelect });
}

function campaignLines(c: Partial<CampaignContext> & { name: string }) {
  return [
    `- Nom : ${c.name}`,
    c.objective && `- Objectif : ${c.objective}`,
    c.audience && `- Cible : ${c.audience}`,
    c.keyMessage && `- Message clé : ${c.keyMessage}`,
    c.callToAction && `- Appel à l'action : ${c.callToAction}`,
    c.period && `- Période : ${c.period}`,
    c.brief && `- Brief : ${c.brief}`,
    c.mainContent && `- Contenu principal : ${c.mainContent.title}`,
  ]
    .filter(Boolean)
    .join("\n");
}

// ---------- Bulk writing ----------

/** Posts of a campaign the bulk writer can draft: no text yet, not locked nor cancelled. */
export async function listPostsToWrite(campaignId: string) {
  const posts = await db.post.findMany({
    where: {
      campaignId,
      deletedAt: null,
      status: { notIn: ["CANCELLED", "PUBLISHED", "PROCESSING"] },
    },
    select: { id: true, status: true, format: true, body: true, youtubeTitle: true },
    orderBy: { scheduledAt: "asc" },
  });
  return posts
    .filter(
      (p) =>
        !isLocked(p.status as PostStatus) && !isComplete({ ...p, format: p.format as PostFormat }),
    )
    .map((p) => p.id);
}

// ---------- Brief helper ----------

export type BriefDraft = {
  name: string;
  objective: string;
  audience: string;
  keyMessage: string;
  callToAction: string;
  brief: string;
};

const questionsSchema = z.object({ questions: z.array(z.string()) });

export async function briefQuestions(
  brand: { id: string; timezone: string },
  draft: BriefDraft,
  actor: Actor,
) {
  const b = await loadBrand(brand.id);
  await consumeAi(brand, actor.userId);
  const result = await generateObject(
    {
      system: brandSystemPrompt(toBrandPrompt(b)),
      user: [
        "Nous préparons le brief d'une campagne de communication :",
        campaignLines(draft),
        "",
        "Posez exactement 3 questions courtes et concrètes, en vouvoyant, pour compléter ce brief (cible précise, message à retenir, preuves ou chiffres, action attendue…). Ne reposez pas une question dont la réponse est déjà donnée.",
      ].join("\n"),
    },
    questionsSchema,
    {
      task: "campaign.brief",
      effort: "low",
      mock: () => ({
        questions: [
          "À qui s'adresse en priorité cette campagne ?",
          "Quelle idée le lecteur doit-il retenir ?",
          "Quels chiffres ou témoignages pouvons-nous mettre en avant ?",
        ],
      }),
    },
  );
  const questions = result.questions
    .map((q) => q.trim())
    .filter(Boolean)
    .slice(0, 3);
  if (questions.length === 0) throw new AppError("UNAVAILABLE");
  return questions;
}

const briefSchema = z.object({
  audience: z.string(),
  keyMessage: z.string(),
  callToAction: z.string(),
  brief: z.string(),
});

export async function writeBrief(
  brand: { id: string; timezone: string },
  draft: BriefDraft,
  answers: { question: string; answer: string }[],
  actor: Actor,
) {
  const b = await loadBrand(brand.id);
  await consumeAi(brand, actor.userId);
  const result = await generateObject(
    {
      system: brandSystemPrompt(toBrandPrompt(b)),
      user: [
        "Campagne :",
        campaignLines(draft),
        "",
        "Réponses de l'équipe :",
        ...answers
          .filter((a) => a.answer.trim())
          .map((a) => `- ${a.question} → ${a.answer.trim()}`),
        "",
        "Rédigez le brief : la cible (une phrase), le message clé (une phrase), l'appel à l'action (court) et un brief détaillé de 4 à 6 phrases (contexte, ton, points à mettre en avant et à éviter). N'inventez aucun chiffre.",
      ].join("\n"),
    },
    briefSchema,
    {
      task: "campaign.brief",
      effort: "medium",
      mock: () => ({
        audience: answers[0]?.answer || "Décideurs IT.",
        keyMessage: answers[1]?.answer || "Un message clé à retenir.",
        callToAction: draft.callToAction || "Regarder la vidéo complète.",
        brief: `[Brief de test] ${draft.name}. ${answers
          .map((a) => a.answer)
          .filter(Boolean)
          .join(" ")}`.trim(),
      }),
    },
  );
  return {
    audience: result.audience.trim().slice(0, 1000),
    keyMessage: result.keyMessage.trim().slice(0, 1000),
    callToAction: result.callToAction.trim().slice(0, 300),
    brief: result.brief.trim().slice(0, 5000),
  };
}

// ---------- Proposed planning ----------

export const plannedPostSchema = z.object({
  week: z.number().int().min(1).max(52),
  day: z.number().int().min(0).max(6),
  time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  account: z.string().min(1).max(120),
  format: z.enum(POST_FORMATS),
  contentCode: z.string().max(30).nullable(),
  angle: z.string().max(500),
});

export type PlannedPost = z.infer<typeof plannedPostSchema>;

const planSchema = z.object({
  posts: z.array(plannedPostSchema.extend({ time: z.string(), angle: z.string() })),
});

/** Weeks covered by the campaign: from its start to its end date, 4 by default, 12 at most. */
export function campaignWeeks(start: Date, end: Date | null) {
  if (!end) return 4;
  const days = Math.round((end.getTime() - start.getTime()) / 86_400_000) + 1;
  return Math.min(12, Math.max(1, Math.ceil(days / 7)));
}

export async function proposePlanning(
  campaignId: string,
  brand: { id: string; timezone: string },
  actor: Actor,
) {
  const campaign = await db.campaign.findUniqueOrThrow({
    where: { id: campaignId },
    select: {
      startDate: true,
      endDate: true,
      contents: {
        where: { deletedAt: null },
        select: { code: true, type: true, title: true },
        orderBy: { code: "asc" },
      },
    },
  });
  if (!campaign.startDate) {
    throw new AppError("INVALID", "Indiquez d'abord la date de début de la campagne (étape 1).");
  }
  const [b, context, accounts, contributors] = await Promise.all([
    loadBrand(brand.id),
    loadCampaignContext(campaignId),
    db.socialAccount.findMany({
      where: { brandId: brand.id, isActive: true },
      select: { name: true, platform: true },
      orderBy: [{ platform: "asc" }, { name: "asc" }],
    }),
    db.contributor.findMany({
      where: { brandId: brand.id, isActive: true },
      select: { firstName: true, lastName: true },
      orderBy: { firstName: "asc" },
    }),
  ]);
  const publishers = [
    ...accounts.map((a) => ({ name: a.name, platform: a.platform })),
    ...contributors.map((p) => ({
      name: `${p.firstName} ${p.lastName ?? ""}`.trim(),
      platform: "LINKEDIN" as const,
    })),
  ];
  if (publishers.length === 0) {
    throw new AppError("INVALID", "Ajoutez d'abord un compte de la marque (Réglages › Comptes).");
  }
  const weeks = campaignWeeks(campaign.startDate, campaign.endDate);

  await consumeAi(brand, actor.userId);
  const result = await generateObject(
    {
      system: brandSystemPrompt(toBrandPrompt(b)),
      user: [
        "Proposez le planning de publication de cette campagne :",
        campaignLines(context),
        `- Durée : ${weeks} semaine${weeks > 1 ? "s" : ""} à partir du lundi ${formatDateOnly(campaign.startDate)}`,
        "",
        "Comptes et relais disponibles (champ « account » : le nom seul, sans le réseau entre parenthèses) :",
        ...publishers.map(
          (p) => `- ${p.name} (${p.platform === "LINKEDIN" ? "LinkedIn" : "YouTube"})`,
        ),
        "",
        campaign.contents.length
          ? [
              "Contenus disponibles (champ « contentCode ») :",
              ...campaign.contents.map((c) => `- ${c.code} : ${c.title} (${c.type})`),
            ].join("\n")
          : "Aucun contenu décrit : contentCode = null.",
        "",
        `Formats : LinkedIn → ${FORMATS_BY_PLATFORM.LINKEDIN.join(", ")} ; YouTube → ${FORMATS_BY_PLATFORM.YOUTUBE.join(", ")}.`,
        `Jours : 0 = ${DAYS[0]} … 6 = ${DAYS[6]}. Heures au format HH:mm.`,
        "Règles : 2 à 4 publications par semaine, du lundi au vendredi ; varier les comptes et les contenus ; chaque contenu au moins une fois s'il y en a ; les Shorts sur YouTube ; un sujet / angle concret et différent pour chaque publication ; pas de publication le même jour sur le même compte.",
      ].join("\n"),
    },
    planSchema,
    {
      task: "campaign.planning",
      effort: "medium",
      mock: () => ({ posts: mockPlan(weeks, publishers, campaign.contents) }),
    },
  );

  // Keep only what the brand can publish: known accounts, allowed formats, known contents.
  // Tolerant: the model sometimes echoes « IT for Business (LinkedIn) » from the list above.
  const byKey = new Map(publishers.map((p) => [normalizeKey(p.name), p]));
  const findPublisher = (account: string) =>
    byKey.get(normalizeKey(account)) ??
    byKey.get(normalizeKey(account.replace(/\s*\((linkedin|youtube)\)\s*$/i, "")));
  const codes = new Set(campaign.contents.map((c) => c.code));
  return result.posts
    .flatMap((p) => {
      const publisher = findPublisher(p.account);
      const parsed = plannedPostSchema.safeParse({
        ...p,
        time: /^\d{1,2}:\d{2}$/.test(p.time) ? p.time.padStart(5, "0") : "09:00",
        contentCode: p.contentCode && codes.has(p.contentCode) ? p.contentCode : null,
        angle: p.angle.slice(0, 500),
      });
      if (!publisher || !parsed.success || p.week > weeks) return [];
      const formats = FORMATS_BY_PLATFORM[publisher.platform] as PostFormat[];
      return [
        {
          ...parsed.data,
          account: publisher.name,
          format: formats.includes(parsed.data.format) ? parsed.data.format : formats[0]!,
          platform: publisher.platform,
        },
      ];
    })
    .sort((a, b) => a.week - b.week || a.day - b.day || a.time.localeCompare(b.time))
    .slice(0, 60);
}

function mockPlan(
  weeks: number,
  publishers: { name: string; platform: "LINKEDIN" | "YOUTUBE" }[],
  contents: { code: string; type: string; title: string }[],
): PlannedPost[] {
  const page = publishers.find((p) => p.platform === "LINKEDIN");
  const youtube = publishers.find((p) => p.platform === "YOUTUBE");
  const capsules = contents.filter((c) => c.type !== "SHORT" && c.type !== "LONG_VIDEO");
  const shorts = contents.filter((c) => c.type === "SHORT");
  const plan: PlannedPost[] = [];
  for (let week = 1; week <= weeks; week++) {
    if (page) {
      const content = capsules[(week - 1) % Math.max(capsules.length, 1)];
      plan.push({
        week,
        day: 0,
        time: "09:00",
        account: page.name,
        format: content ? "VIDEO_POST" : "TEXT",
        contentCode: content?.code ?? null,
        angle: `[Test] Angle de la semaine ${week}`,
      });
    }
    if (youtube) {
      const content = shorts[(week - 1) % Math.max(shorts.length, 1)];
      plan.push({
        week,
        day: 3,
        time: "12:00",
        account: youtube.name,
        format: "SHORT",
        contentCode: content?.code ?? null,
        angle: `[Test] Extrait de la semaine ${week}`,
      });
    }
  }
  return plan;
}
