// Seed (§13). Idempotent: running it twice changes nothing.
//   npm run db:seed                 → brand, accounts, contributor, super admin + LDDLT demo
//   SEED_DEMO=false npm run db:seed → production: no demo campaign
import { PrismaNeon } from "@prisma/adapter-neon";
import { PrismaPg } from "@prisma/adapter-pg";
import { fromWeekDay, parseDateOnly } from "../src/lib/dates";
import { PrismaClient } from "../src/generated/prisma/client";
import { LDDLT_CAMPAIGN, LDDLT_CONTENTS, LDDLT_POSTS } from "./seed-data/lddlt";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL manquante : impossible de lancer le seed.");
const host = new URL(url).hostname;
const adapter =
  host === "localhost" || host === "127.0.0.1" || host === "postgres"
    ? new PrismaPg({ connectionString: url })
    : new PrismaNeon({ connectionString: url });
const db = new PrismaClient({ adapter });

const SUPER_ADMIN_EMAIL = process.env.SEED_SUPER_ADMIN_EMAIL ?? "cem@choyou.fr";
const BRAND_COLOR = process.env.SEED_BRAND_COLOR ?? "#1F3A5F";
const WITH_DEMO = process.env.SEED_DEMO !== "false";
const TZ = "Europe/Paris";
/** Tests move the demo campaign into the future so it never contains past posts. */
const DEMO_START = process.env.SEED_DEMO_START ?? LDDLT_CAMPAIGN.startDate;

async function main() {
  const admin = await db.user.upsert({
    where: { email: SUPER_ADMIN_EMAIL },
    create: { email: SUPER_ADMIN_EMAIL, name: "Cem", isSuperAdmin: true },
    update: { isSuperAdmin: true, isActive: true },
  });

  const brand = await db.brand.upsert({
    where: { slug: "it-for-business" },
    create: {
      name: "IT for Business",
      slug: "it-for-business",
      color: BRAND_COLOR,
      timezone: TZ,
      editorialLine:
        "Média de référence des décideurs IT : retours d'expérience concrets, tendances et bonnes pratiques de la transformation numérique.",
      tone: "Expert mais accessible, concret, chaleureux. Vouvoiement. Pas de jargon marketing.",
      dos: "Commencer par une accroche forte. Citer des faits et des chiffres. Mettre en avant les témoignages.",
      donts: "Pas de superlatifs creux, pas de promesses vagues, pas plus de deux emojis.",
      hashtags: ["ITforBusiness", "DSI", "TransformationNumérique"],
      defaultCta: "Regardez la vidéo complète.",
      mentionHandle: "IT for Business",
    },
    update: {},
  });

  await db.membership.upsert({
    where: { userId_brandId: { userId: admin.id, brandId: brand.id } },
    create: { userId: admin.id, brandId: brand.id, role: "ADMIN" },
    update: {},
  });

  const anneLaure = await db.contributor.upsert({
    where: { brandId_email: { brandId: brand.id, email: "anne-laure@example.invalid" } },
    create: {
      brandId: brand.id,
      firstName: "Anne Laure",
      email: "anne-laure@example.invalid", // provisional, see CLAUDE.md §16.5
    },
    update: {},
  });

  const findOrCreateAccount = async (
    name: string,
    platform: "LINKEDIN" | "YOUTUBE",
    publishMode: "KIT" | "STUDIO",
  ) =>
    (await db.socialAccount.findFirst({ where: { brandId: brand.id, name } })) ??
    db.socialAccount.create({ data: { brandId: brand.id, name, platform, publishMode } });

  const page = await findOrCreateAccount("IT for Business", "LINKEDIN", "KIT");
  const youtube = await findOrCreateAccount("IT for Business YouTube", "YOUTUBE", "STUDIO");

  if (WITH_DEMO)
    await seedDemoCampaign(brand.id, admin.id, {
      page: page.id,
      youtube: youtube.id,
      anneLaure: anneLaure.id,
    });

  console.log(
    `Seed terminé : marque « ${brand.name} », super admin ${admin.email}${WITH_DEMO ? ", campagne de démo" : ""}.`,
  );
}

async function seedDemoCampaign(
  brandId: string,
  adminId: string,
  ids: { page: string; youtube: string; anneLaure: string },
) {
  const existing = await db.campaign.findFirst({ where: { brandId, name: LDDLT_CAMPAIGN.name } });
  if (existing) return;

  await db.$transaction(async (tx) => {
    const campaign = await tx.campaign.create({
      data: {
        brandId,
        name: LDDLT_CAMPAIGN.name,
        status: "DRAFT",
        objective: LDDLT_CAMPAIGN.objective,
        audience: LDDLT_CAMPAIGN.audience,
        keyMessage: LDDLT_CAMPAIGN.keyMessage,
        callToAction: LDDLT_CAMPAIGN.callToAction,
        brief: LDDLT_CAMPAIGN.brief,
        startDate: parseDateOnly(DEMO_START),
        endDate: new Date(parseDateOnly(DEMO_START).getTime() + 39 * 86_400_000),
        wizardStep: 5,
        createdById: adminId,
      },
    });

    const contentIds = new Map<string, string>();
    for (const c of LDDLT_CONTENTS) {
      const created = await tx.content.create({
        data: {
          campaignId: campaign.id,
          code: c.code,
          type: c.type,
          title: c.title,
          mediaUrl: c.mediaUrl,
          parentId: c.parent ? contentIds.get(c.parent) : null,
        },
      });
      contentIds.set(c.code, created.id);
    }
    await tx.campaign.update({
      where: { id: campaign.id },
      data: { mainContentId: contentIds.get("VID-LONG") },
    });

    await tx.post.createMany({
      data: LDDLT_POSTS.map((p, i) => ({
        campaignId: campaign.id,
        socialAccountId:
          p.publisher === "page" ? ids.page : p.publisher === "youtube" ? ids.youtube : null,
        authorContributorId: p.publisher === "anne-laure" ? ids.anneLaure : null,
        format: p.format,
        scheduledAt: fromWeekDay(DEMO_START, p.week, p.dayOffset, p.time, TZ),
        contentId: contentIds.get(p.content) ?? null,
        linkToContentId: p.linkTo ? (contentIds.get(p.linkTo) ?? null) : null,
        angle: p.angle ?? null,
        bodySource: "EMPTY" as const,
        importRowRef: `Planning!${i + 2}`,
      })),
    });

    await tx.activity.create({
      data: {
        brandId,
        campaignId: campaign.id,
        actorId: adminId,
        type: "campaign.created",
        meta: { name: campaign.name },
      },
    });
  });
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
