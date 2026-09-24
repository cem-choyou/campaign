import "server-only";
import { randomUUID } from "node:crypto";
import { formatDateOnly } from "@/lib/dates";
import {
  type Grid,
  type Mapping,
  type MappingField,
  buildFreeWorkbook,
  distinctValues,
} from "@/lib/import/free";
import type { ContentType } from "@/lib/import/normalize";
import { type BrandData, resolveImport } from "@/lib/import/resolve";
import type { ImportPreview, Overrides, ParsedWorkbook, PreviewChoices } from "@/lib/import/types";
import { type PostFormat, isComplete } from "@/lib/posts";
import { extractYoutubeId } from "@/lib/youtube";
import { interpretValues } from "@/server/ai/import";
import { db } from "@/server/db";
import { AppError } from "@/server/errors";

// Excel import (§8.8): an ImportJob keeps the parsed file between the preview and the import.
// The preview is recomputed on the server from the stored file and the user's corrections, and
// the import itself runs in one transaction: everything is created, or nothing.

type Actor = { id: string };

export type ImportMode = "add" | "replace";

export async function loadBrandData(
  brandId: string,
  campaignId: string | null,
  canCreateContributors: boolean,
): Promise<BrandData> {
  const [brand, campaign] = await Promise.all([
    db.brand.findUniqueOrThrow({
      where: { id: brandId },
      select: {
        name: true,
        timezone: true,
        accounts: {
          where: { isActive: true },
          select: { id: true, name: true, platform: true },
          orderBy: [{ platform: "asc" }, { name: "asc" }],
        },
        contributors: {
          where: { isActive: true },
          select: { id: true, firstName: true, lastName: true, email: true },
          orderBy: { firstName: "asc" },
        },
      },
    }),
    campaignId
      ? db.campaign.findFirst({
          where: { id: campaignId, brandId },
          select: {
            name: true,
            startDate: true,
            contents: {
              where: { deletedAt: null },
              select: { code: true, type: true, title: true },
            },
          },
        })
      : null,
  ]);
  if (campaignId && !campaign) throw new AppError("NOT_FOUND");
  return {
    name: brand.name,
    timezone: brand.timezone,
    accounts: brand.accounts,
    contributors: brand.contributors,
    campaign: campaign
      ? {
          name: campaign.name,
          startDate: campaign.startDate ? formatDateOnly(campaign.startDate) : null,
          contents: campaign.contents.map((c) => ({ ...c, type: c.type as ContentType })),
        }
      : null,
    canCreateContributors,
  };
}

export function previewChoices(brand: BrandData, preview: ImportPreview): PreviewChoices {
  return {
    accounts: [
      ...brand.accounts.map((a) => ({
        value: `account:${a.id}`,
        label: a.name,
        platform: a.platform,
      })),
      ...brand.contributors.map((p) => ({
        value: `contributor:${p.id}`,
        label: `${p.firstName} ${p.lastName ?? ""}`.trim(),
        platform: "LINKEDIN" as const,
      })),
    ],
    contentCodes: [
      ...new Map(
        [
          ...(brand.campaign?.contents ?? []).map((c) => [c.code, c.title] as const),
          ...preview.contents.map((c) => [c.code, c.title] as const),
        ].map(([code, title]) => [code, { code, title }]),
      ).values(),
    ].sort((a, b) => a.code.localeCompare(b.code)),
  };
}

export async function createImportJob(input: {
  brandId: string;
  campaignId: string | null;
  fileName: string;
  parsed: ParsedWorkbook | null;
  status: "PARSED" | "NEEDS_MAPPING" | "FAILED";
  payload?: unknown;
  actor: Actor;
}) {
  return db.importJob.create({
    data: {
      brandId: input.brandId,
      campaignId: input.campaignId,
      fileName: input.fileName.slice(0, 200),
      status: input.status,
      report: {},
      payload: (input.payload ?? input.parsed ?? undefined) as object | undefined,
      createdById: input.actor.id,
    },
    select: { id: true },
  });
}

/** The job, checked against the brand and the person who uploaded it. */
export async function getImportJob(jobId: string, brandId: string, actor: Actor) {
  const job = await db.importJob.findFirst({
    where: { id: jobId, brandId, createdById: actor.id },
    select: {
      id: true,
      campaignId: true,
      status: true,
      payload: true,
      fileName: true,
      mapping: true,
    },
  });
  if (!job) throw new AppError("NOT_FOUND", "Cet import a expiré. Déposez à nouveau le fichier.");
  if (job.status === "IMPORTED") throw new AppError("CONFLICT", "Ce fichier a déjà été importé.");
  return job;
}

/** Payload of a free-form file: the grid, the mapping, and once confirmed the parsed workbook. */
export type GridPayload = {
  kind: "grid";
  grid: Grid;
  mapping: Mapping;
  source: "ai" | "heuristic";
  parsed?: ParsedWorkbook;
};

function isGridPayload(payload: unknown): payload is GridPayload {
  return !!payload && typeof payload === "object" && (payload as GridPayload).kind === "grid";
}

function parsedOf(payload: unknown): ParsedWorkbook | null {
  const parsed = isGridPayload(payload) ? payload.parsed : (payload as ParsedWorkbook | null);
  return parsed && Array.isArray(parsed.rows) ? parsed : null;
}

/** What the « correspondance des colonnes » step shows. */
export function mappingView(
  payload: GridPayload,
  defaults: { name: string; startDate: string | null },
) {
  return {
    sheet: payload.grid.sheet,
    headers: payload.grid.headers,
    samples: payload.grid.rows.slice(0, 5).map((r) => r.cells),
    rowCount: payload.grid.rows.length,
    mapping: payload.mapping,
    source: payload.source,
    defaults,
  };
}

export type MappingView = ReturnType<typeof mappingView>;

/** Mapping confirmed: interprets the values (AI, with heuristic fallback) and parses the grid. */
export async function confirmMapping(input: {
  jobId: string;
  brand: { id: string; timezone: string };
  mapping: Mapping;
  name: string;
  startDate: string | null;
  canCreateContributors: boolean;
  actor: Actor;
}) {
  const job = await getImportJob(input.jobId, input.brand.id, input.actor);
  if (!isGridPayload(job.payload)) throw new AppError("CONFLICT");
  const { grid } = job.payload;
  if (input.mapping.length !== grid.headers.length) throw new AppError("INVALID");
  const has = (field: MappingField) => input.mapping.includes(field);
  if (!has("account")) {
    throw new AppError("INVALID", "Indiquez la colonne du compte qui publie.");
  }
  if (!has("date") && !(has("week") && has("day"))) {
    throw new AppError(
      "INVALID",
      "Indiquez la colonne de la date, ou celles de la semaine et du jour.",
    );
  }
  if (!has("date") && !input.startDate && !job.campaignId) {
    throw new AppError("INVALID", "Indiquez la date du lundi de la semaine 1.");
  }

  const brand = await loadBrandData(input.brand.id, job.campaignId, input.canCreateContributors);
  const publishers = [
    ...brand.accounts.map((a) => ({ name: a.name, platform: a.platform })),
    ...brand.contributors.map((p) => ({
      name: `${p.firstName} ${p.lastName ?? ""}`.trim(),
      platform: "LINKEDIN" as const,
    })),
  ];
  const { interpretation } = await interpretValues(
    distinctValues(grid, input.mapping),
    publishers,
    input.brand,
    input.actor.id,
  );
  const parsed = buildFreeWorkbook(grid, input.mapping, interpretation, {
    name: input.name,
    startDate: input.startDate,
  });
  await db.importJob.update({
    where: { id: job.id },
    data: {
      status: "PARSED",
      mapping: { columns: input.mapping } as object,
      payload: { ...job.payload, mapping: input.mapping, parsed } as object,
    },
  });
  const preview = resolveImport(parsed, brand, {});
  return { preview, choices: previewChoices(brand, preview) };
}

export async function previewImport(
  job: { campaignId: string | null; payload: unknown },
  brandId: string,
  overrides: Overrides,
  canCreateContributors: boolean,
) {
  const parsed = parsedOf(job.payload);
  if (!parsed) {
    throw new AppError("CONFLICT", "La correspondance des colonnes n'est pas encore confirmée.");
  }
  const brand = await loadBrandData(brandId, job.campaignId, canCreateContributors);
  const preview = resolveImport(parsed, brand, overrides);
  return { preview, choices: previewChoices(brand, preview) };
}

/** Creates the campaign, contents, contributors, posts and missions — all or nothing. */
export async function commitImport(input: {
  jobId: string;
  brandId: string;
  overrides: Overrides;
  mode: ImportMode;
  canCreateContributors: boolean;
  actor: Actor;
}) {
  const job = await getImportJob(input.jobId, input.brandId, input.actor);
  const { preview } = await previewImport(
    job,
    input.brandId,
    input.overrides,
    input.canCreateContributors,
  );
  if (preview.counts.errors > 0) {
    const first =
      preview.issues.find((i) => i.level === "error")?.message ??
      preview.posts
        .flatMap((p) =>
          p.issues.filter((i) => i.level === "error").map((i) => `ligne ${p.row} : ${i.message}`),
        )
        .at(0);
    throw new AppError(
      "INVALID",
      `${
        preview.counts.errors === 1
          ? "Il reste une erreur à corriger avant d'importer"
          : `Il reste ${preview.counts.errors} erreurs à corriger avant d'importer`
      }${first ? ` (${first})` : ""}.`,
    );
  }
  const posts = preview.posts.filter((p) => !p.skip);
  if (posts.length === 0) throw new AppError("INVALID", "Aucun post à importer.");
  const now = new Date();

  const result = await db.$transaction(
    async (tx) => {
      // Campaign
      let campaignId = job.campaignId;
      const lastDate =
        posts
          .map((p) => p.date!)
          .sort()
          .at(-1) ?? null;
      const c = preview.campaign;
      if (!campaignId) {
        const created = await tx.campaign.create({
          data: {
            brandId: input.brandId,
            name: c.name.slice(0, 120),
            objective: c.objective,
            audience: c.audience,
            brief: c.brief,
            startDate: c.startDate ? new Date(`${c.startDate}T00:00:00Z`) : null,
            endDate: lastDate ? new Date(`${lastDate}T00:00:00Z`) : null,
            wizardStep: 5,
            createdById: input.actor.id,
          },
          select: { id: true },
        });
        campaignId = created.id;
      } else {
        // Existing campaign: only fill what is still empty.
        const current = await tx.campaign.findUniqueOrThrow({
          where: { id: campaignId },
          select: { objective: true, audience: true, brief: true, startDate: true, endDate: true },
        });
        await tx.campaign.update({
          where: { id: campaignId },
          data: {
            objective: current.objective ?? c.objective,
            audience: current.audience ?? c.audience,
            brief: current.brief ?? c.brief,
            startDate:
              current.startDate ?? (c.startDate ? new Date(`${c.startDate}T00:00:00Z`) : null),
            endDate:
              lastDate && (!current.endDate || formatDateOnly(current.endDate) < lastDate)
                ? new Date(`${lastDate}T00:00:00Z`)
                : current.endDate,
          },
        });
      }

      // Contributors named in the planning and new to the brand (admins only).
      const contributorIds = new Map<string, string>();
      for (const p of preview.newContributors) {
        const row = await tx.contributor.upsert({
          where: { brandId_email: { brandId: input.brandId, email: p.email! } },
          create: {
            brandId: input.brandId,
            firstName: p.firstName,
            lastName: p.lastName,
            email: p.email!,
            jobTitle: p.jobTitle,
            linkedinUrl: p.linkedinUrl,
            toneNote: p.toneNote,
          },
          update: {},
          select: { id: true },
        });
        contributorIds.set(p.key, row.id);
      }

      // Contents: upsert by code within the campaign.
      const existing = await tx.content.findMany({
        where: { campaignId },
        select: { id: true, code: true, deletedAt: true },
      });
      const contentIds = new Map(existing.filter((e) => !e.deletedAt).map((e) => [e.code, e.id]));
      for (const item of preview.contents) {
        const data = {
          type: item.type,
          title: item.title,
          ...(item.mediaUrl ? { mediaUrl: item.mediaUrl } : {}),
          ...(item.durationSec ? { durationSec: item.durationSec } : {}),
          ...(item.summary ? { summary: item.summary } : {}),
          ...(item.youtubeUrl && extractYoutubeId(item.youtubeUrl)
            ? { youtubeVideoId: extractYoutubeId(item.youtubeUrl) }
            : {}),
        };
        const id = contentIds.get(item.code);
        if (id) {
          await tx.content.update({ where: { id }, data });
          continue;
        }
        const deleted = existing.find((e) => e.code === item.code && e.deletedAt);
        if (deleted) {
          // A soft-deleted content still holds the code: free it (same rule as saveContent).
          await tx.content.update({
            where: { id: deleted.id },
            data: { code: `${item.code}~${deleted.id.slice(-6)}` },
          });
        }
        const created = await tx.content.create({
          data: { ...data, campaignId, code: item.code },
          select: { id: true },
        });
        contentIds.set(item.code, created.id);
      }
      // Shorts point to the main long video.
      if (c.mainContentCode) {
        const mainId = contentIds.get(c.mainContentCode)!;
        await tx.campaign.update({
          where: { id: campaignId },
          data: { mainContentId: mainId },
        });
        const shortCodes = preview.contents.filter((i) => i.type === "SHORT").map((i) => i.code);
        const shortIds = shortCodes.map((code) => contentIds.get(code)!).filter(Boolean);
        if (shortIds.length) {
          await tx.content.updateMany({
            where: { id: { in: shortIds }, parentId: null },
            data: { parentId: mainId },
          });
        }
      }

      // « Remplacer les brouillons »: never validated or published posts (§8.8).
      let replaced = 0;
      if (job.campaignId && input.mode === "replace") {
        const res = await tx.post.updateMany({
          where: { campaignId, status: "DRAFT", deletedAt: null },
          data: { deletedAt: now },
        });
        replaced = res.count;
      }

      // Posts and missions
      const contributorId = (id: string | null, key?: string) =>
        id ?? (key ? contributorIds.get(key) : undefined);
      const postRows = [];
      const missionRows = [];
      for (const p of posts) {
        const id = randomUUID();
        const publisher = p.publisher!;
        const authorId =
          publisher.kind === "contributor" ? contributorId(publisher.id, publisher.key) : undefined;
        const isYouTube = publisher.platform === "YOUTUBE";
        postRows.push({
          id,
          campaignId,
          socialAccountId: publisher.kind === "account" ? publisher.id : null,
          authorContributorId: authorId ?? null,
          format: p.format!,
          scheduledAt: new Date(p.scheduledAt!),
          contentId: p.contentCode ? (contentIds.get(p.contentCode) ?? null) : null,
          linkToContentId: p.linkToCode ? (contentIds.get(p.linkToCode) ?? null) : null,
          linkToUrl: p.linkToUrl,
          angle: p.angle || null,
          body: !isYouTube && p.body ? p.body : null,
          youtubeDescription: isYouTube && p.body ? p.body : null,
          bodySource: p.body ? ("IMPORTED" as const) : ("EMPTY" as const),
          status: p.published ? ("PUBLISHED" as const) : ("DRAFT" as const),
          publishedUrl: p.publishedUrl,
          publishedAt: p.published ? new Date(p.scheduledAt!) : null,
          importRowRef: `Planning!${p.row}`,
        });
        if (authorId) {
          missionRows.push({
            postId: id,
            contributorId: authorId,
            type: "POST" as const,
            status: p.published ? ("DONE" as const) : ("PLANNED" as const),
            publishedUrl: p.publishedUrl,
            doneAt: p.published ? new Date(p.scheduledAt!) : null,
          });
        }
        for (const relay of p.relays) {
          const relayId = contributorId(relay.contributorId, relay.key);
          if (relayId && relayId !== authorId) {
            missionRows.push({
              postId: id,
              contributorId: relayId,
              type: "RELAY" as const,
              status: "PLANNED" as const,
            });
          }
        }
      }
      await tx.post.createMany({ data: postRows });
      if (missionRows.length)
        await tx.mission.createMany({ data: missionRows, skipDuplicates: true });

      const report = {
        rows: preview.posts.length,
        created: postRows.length,
        skipped: preview.counts.skipped,
        replaced,
        missions: missionRows.length,
        contents: preview.contents.length,
        contributors: preview.newContributors.length,
        warnings: preview.counts.warnings,
        /** Posts the bulk writer can draft next (no text yet, not published). */
        toWrite: postRows.filter(
          (p) =>
            p.status !== "PUBLISHED" &&
            !isComplete({ format: p.format, body: p.body, youtubeTitle: null }),
        ).length,
      };
      await tx.importJob.update({
        where: { id: job.id },
        data: {
          status: "IMPORTED",
          campaignId,
          report,
          mapping: { overrides: input.overrides } as object,
        },
      });
      await tx.activity.create({
        data: {
          brandId: input.brandId,
          campaignId,
          actorId: input.actor.id,
          type: "campaign.imported",
          meta: { fileName: job.fileName, created: postRows.length, replaced },
        },
      });
      return { campaignId, ...report };
    },
    { timeout: 30_000, maxWait: 10_000 },
  );
  return result;
}

/**
 * « Laisser l'IA proposer un planning » (§8.5): the accepted proposal goes through exactly the same
 * checks and transaction as an Excel import into the campaign.
 */
export async function createPostsFromPlan(input: {
  campaignId: string;
  brandId: string;
  items: {
    week: number;
    day: number;
    time: string;
    account: string;
    format: PostFormat;
    contentCode: string | null;
    angle: string;
  }[];
  actor: Actor;
}) {
  const parsed: ParsedWorkbook = {
    kind: "template",
    campaign: {
      brand: "",
      name: "",
      startDate: null,
      objective: "",
      audience: "",
      brief: "",
      mainContentCode: "",
    },
    contents: [],
    contributors: [],
    rows: input.items.map((item, i) => ({
      row: i + 1,
      week: item.week,
      weekLabel: String(item.week),
      dayOffset: item.day,
      dayLabel: "",
      date: null,
      time: item.time,
      timeLabel: item.time,
      account: item.account,
      format: item.format,
      formatLabel: "",
      contentCode: item.contentCode ?? "",
      linkTo: "",
      angle: item.angle,
      body: "",
      relayNames: [],
      statusPublished: false,
      published: false,
      publishedUrl: "",
    })),
    fileIssues: [],
  };
  const job = await createImportJob({
    brandId: input.brandId,
    campaignId: input.campaignId,
    fileName: "Planning proposé par l'IA",
    parsed,
    status: "PARSED",
    actor: input.actor,
  });
  return commitImport({
    jobId: job.id,
    brandId: input.brandId,
    overrides: {},
    mode: "add",
    canCreateContributors: false,
    actor: input.actor,
  });
}

/** Brand data for the downloadable template (§12). */
export async function getTemplateInput(brandId: string) {
  const brand = await db.brand.findUniqueOrThrow({
    where: { id: brandId },
    select: {
      name: true,
      slug: true,
      color: true,
      accounts: {
        where: { isActive: true },
        select: { name: true, platform: true, publishMode: true },
        orderBy: [{ platform: "asc" }, { name: "asc" }],
      },
      contributors: {
        where: { isActive: true },
        select: {
          firstName: true,
          lastName: true,
          email: true,
          jobTitle: true,
          linkedinUrl: true,
          toneNote: true,
        },
        orderBy: { firstName: "asc" },
      },
    },
  });
  return brand;
}
