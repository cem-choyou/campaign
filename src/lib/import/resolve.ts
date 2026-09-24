// Matches a parsed workbook with the brand (accounts, contributors, campaign contents) and the
// user's corrections, then checks every row (§8.8, §12). Pure: the server runs it for the preview
// and again, unchanged, right before creating anything.

import {
  DEFAULT_TIME,
  fromWeekDay,
  isDateOnly,
  isTime,
  localToUtc,
  parseDateOnly,
} from "@/lib/dates";
import {
  FORMAT_LABELS,
  cleanText,
  isUrl,
  normalizeKey,
  type ContentType,
} from "@/lib/import/normalize";
import type {
  ImportPreview,
  Issue,
  Overrides,
  ParsedWorkbook,
  PreviewContent,
  PreviewContributor,
  PreviewPost,
  PreviewPublisher,
} from "@/lib/import/types";
import {
  LIMITS,
  type Platform,
  type PostFormat,
  decodePublisher,
  isFormatAllowed,
} from "@/lib/posts";
import { contentCode as contentCodeSchema } from "@/lib/validations/content";

export type BrandData = {
  name: string;
  timezone: string;
  accounts: { id: string; name: string; platform: Platform }[];
  contributors: { id: string; firstName: string; lastName: string | null; email: string }[];
  /** Importing into an existing campaign. */
  campaign: {
    name: string;
    startDate: string | null;
    contents: { code: string; type: ContentType; title: string }[];
  } | null;
  /** Contributors unknown to the brand can only be created by brand admins (§7). */
  canCreateContributors: boolean;
};

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const error = (message: string, field?: string): Issue => ({ level: "error", message, field });
const warning = (message: string, field?: string): Issue => ({ level: "warning", message, field });

function fullName(first: string, last: string | null | undefined) {
  return `${first} ${last ?? ""}`.trim();
}

/** Index of names → items; a key shared by two items is ambiguous and matches nothing. */
function nameIndex<T>(items: T[], keysOf: (item: T) => string[]) {
  const map = new Map<string, T | null>();
  for (const item of items) {
    for (const key of new Set(keysOf(item).map(normalizeKey).filter(Boolean))) {
      map.set(key, map.has(key) && map.get(key) !== item ? null : item);
    }
  }
  return (name: string) => map.get(normalizeKey(name)) ?? undefined;
}

function inferFormat(platform: Platform, contentType: ContentType | null): PostFormat {
  if (platform === "YOUTUBE") return contentType === "SHORT" ? "SHORT" : "LONG_VIDEO";
  if (contentType === "IMAGE") return "IMAGE";
  if (contentType === "DOCUMENT") return "DOCUMENT";
  return contentType ? "VIDEO_POST" : "TEXT";
}

export function resolveImport(
  parsed: ParsedWorkbook,
  brand: BrandData,
  overrides: Overrides = {},
  now: Date = new Date(),
): ImportPreview {
  const issues: Issue[] = parsed.fileIssues.map((m) => error(m));
  const tz = brand.timezone;

  // ---------- Campaign ----------
  const c = parsed.campaign;
  const name = c.name || brand.campaign?.name || "";
  const startDate = c.startDate ?? brand.campaign?.startDate ?? null;
  if (!brand.campaign && !name) {
    issues.push(
      error("Donnez un nom à la campagne (onglet Campagne, « Nom de la campagne »).", "Campagne"),
    );
  }
  if (c.brand && normalizeKey(c.brand) !== normalizeKey(brand.name)) {
    issues.push(
      warning(
        `Le fichier indique la marque « ${c.brand} » : les posts seront créés dans « ${brand.name} ».`,
        "Campagne",
      ),
    );
  }
  if (startDate && parseDateOnly(startDate).getUTCDay() !== 1) {
    issues.push(
      warning(
        "La date de début n'est pas un lundi : les semaines commenceront ce jour-là.",
        "Campagne",
      ),
    );
  }

  // ---------- Contents ----------
  const contents = new Map<string, PreviewContent>();
  for (const existing of brand.campaign?.contents ?? []) {
    contents.set(existing.code, {
      code: existing.code,
      type: existing.type,
      title: existing.title,
      mediaUrl: null,
      durationSec: null,
      summary: null,
      youtubeUrl: null,
      existing: true,
    });
  }
  const seen = new Set<string>();
  for (const item of parsed.contents) {
    const where = `Contenus, ligne ${item.row}`;
    const code = contentCodeSchema.safeParse(item.code);
    if (!code.success) {
      issues.push(
        error(`ID « ${item.code || "vide"} » invalide : ${code.error.issues[0]?.message}`, where),
      );
      continue;
    }
    if (seen.has(code.data)) {
      issues.push(error(`L'ID ${code.data} apparaît deux fois dans l'onglet Contenus.`, where));
      continue;
    }
    seen.add(code.data);
    const existing = contents.get(code.data);
    const type = item.type ?? existing?.type ?? null;
    if (!type) {
      issues.push(
        error(
          item.typeLabel
            ? `Type « ${item.typeLabel} » inconnu pour ${code.data} (Vidéo longue, Capsule, Short, Image ou Document PDF).`
            : `Choisissez le type du contenu ${code.data}.`,
          where,
        ),
      );
      continue;
    }
    const title = item.title || existing?.title || code.data;
    if (!item.title && !existing)
      issues.push(warning(`${code.data} n'a pas de titre : son ID sera utilisé.`, where));
    if (item.mediaUrl && !isUrl(item.mediaUrl)) {
      issues.push(
        warning(`Le lien média de ${code.data} n'est pas une adresse web : il est ignoré.`, where),
      );
    }
    contents.set(code.data, {
      code: code.data,
      type,
      title: title.slice(0, 160),
      mediaUrl: isUrl(item.mediaUrl) ? item.mediaUrl : null,
      durationSec: item.durationSec,
      summary: item.summary || null,
      youtubeUrl: item.youtubeUrl || null,
      existing: !!existing,
    });
  }
  const mainContentCode =
    c.mainContentCode && contents.has(c.mainContentCode) ? c.mainContentCode : null;
  if (c.mainContentCode && !mainContentCode) {
    issues.push(
      warning(
        `La vidéo principale ${c.mainContentCode} n'est pas dans l'onglet Contenus.`,
        "Campagne",
      ),
    );
  }

  // ---------- People and accounts ----------
  const findContributor = nameIndex(brand.contributors, (p) => [
    fullName(p.firstName, p.lastName),
    p.firstName,
    p.email,
  ]);
  const fileByName = nameIndex(parsed.contributors, (p) => [
    fullName(p.firstName, p.lastName),
    p.firstName,
    p.email,
  ]);
  const newContributors = new Map<string, PreviewContributor>();

  /** A person named in the planning: known contributor, or one from the Relais sheet to create. */
  const person = (
    label: string,
  ): { id: string | null; name: string; key?: string } | "unknown" | "no-email" | "forbidden" => {
    const known = findContributor(label);
    if (known) return { id: known.id, name: fullName(known.firstName, known.lastName) };
    const fromFile = fileByName(label);
    if (!fromFile) return "unknown";
    const email = fromFile.email.toLowerCase();
    const byEmail = brand.contributors.find((p) => p.email.toLowerCase() === email);
    if (byEmail) return { id: byEmail.id, name: fullName(byEmail.firstName, byEmail.lastName) };
    if (!EMAIL.test(email)) return "no-email";
    if (!brand.canCreateContributors) return "forbidden";
    const key = email;
    if (!newContributors.has(key)) {
      newContributors.set(key, {
        key,
        name: fullName(fromFile.firstName, fromFile.lastName),
        firstName: fromFile.firstName,
        lastName: fromFile.lastName || null,
        email,
        jobTitle: fromFile.jobTitle || null,
        linkedinUrl: isUrl(fromFile.linkedinUrl) ? fromFile.linkedinUrl : null,
        toneNote: fromFile.toneNote || null,
        existingId: null,
      });
    }
    return { id: null, name: fullName(fromFile.firstName, fromFile.lastName), key };
  };

  const findAccount = nameIndex(brand.accounts, (a) => [a.name]);
  const account = (label: string) => {
    const exact = findAccount(label);
    if (exact) return { account: exact, approximate: false };
    const key = normalizeKey(label);
    const close = brand.accounts.filter((a) => {
      const k = normalizeKey(a.name);
      return key.length >= 3 && (k.includes(key) || key.includes(k));
    });
    return close.length === 1 ? { account: close[0]!, approximate: true } : null;
  };

  const personIssue = (
    label: string,
    result: "unknown" | "no-email" | "forbidden",
    role: string,
  ) =>
    result === "no-email"
      ? `${role} « ${label} » n'est pas encore dans les relais de la marque : indiquez son e-mail dans l'onglet Relais, ou choisissez un compte existant.`
      : result === "forbidden"
        ? `${role} « ${label} » n'est pas encore dans les relais de la marque : demandez à un administrateur de l'ajouter, ou choisissez un compte existant.`
        : `${role} « ${label} » inconnu : choisissez un compte ou un relais de la marque.`;

  // ---------- Rows ----------
  const posts: PreviewPost[] = parsed.rows.map((row) => {
    const o = overrides[row.row] ?? {};
    const rowIssues: Issue[] = [];

    // Publisher
    let publisher: PreviewPublisher | null = null;
    if (o.publisher) {
      const decoded = decodePublisher(o.publisher);
      const acc =
        decoded?.kind === "account" ? brand.accounts.find((a) => a.id === decoded.id) : undefined;
      const ctb =
        decoded?.kind === "contributor"
          ? brand.contributors.find((p) => p.id === decoded.id)
          : undefined;
      if (acc) publisher = { kind: "account", id: acc.id, name: acc.name, platform: acc.platform };
      else if (ctb)
        publisher = {
          kind: "contributor",
          id: ctb.id,
          name: fullName(ctb.firstName, ctb.lastName),
          platform: "LINKEDIN",
        };
    }
    if (!publisher) {
      if (!row.account) {
        rowIssues.push(error("Choisissez le compte qui publie.", "account"));
      } else {
        const acc = account(row.account);
        if (acc) {
          publisher = {
            kind: "account",
            id: acc.account.id,
            name: acc.account.name,
            platform: acc.account.platform,
          };
          if (acc.approximate)
            rowIssues.push(
              warning(`« ${row.account} » rapproché du compte « ${acc.account.name} ».`, "account"),
            );
        } else {
          const p = person(row.account);
          if (typeof p === "string")
            rowIssues.push(error(personIssue(row.account, p, "Compte"), "account"));
          else
            publisher = {
              kind: "contributor",
              id: p.id,
              key: p.key,
              name: p.name,
              platform: "LINKEDIN",
            };
        }
      }
    }
    const platform: Platform = publisher?.platform ?? "LINKEDIN";

    // Content
    const code = o.contentCode !== undefined ? o.contentCode : row.contentCode || null;
    const content = code ? contents.get(code) : undefined;
    if (code && !content)
      rowIssues.push(error(`Contenu ${code} absent de l'onglet Contenus.`, "content"));

    // Format
    let format: PostFormat | null = o.format ?? row.format ?? null;
    if (!format && row.formatLabel) {
      rowIssues.push(
        error(
          `Format « ${row.formatLabel} » inconnu (${Object.values(FORMAT_LABELS).join(", ")}).`,
          "format",
        ),
      );
    }
    if (!format && !row.formatLabel && publisher)
      format = inferFormat(platform, content?.type ?? null);
    if (format && publisher && !isFormatAllowed(platform, format)) {
      rowIssues.push(
        error(
          platform === "YOUTUBE"
            ? `Sur YouTube, choisissez le format Short ou Vidéo longue (pas « ${FORMAT_LABELS[format]} »).`
            : `Le format « ${FORMAT_LABELS[format]} » n'existe pas sur LinkedIn.`,
          "format",
        ),
      );
    }

    // Date and time
    let date: string | null = o.date && isDateOnly(o.date) ? o.date : row.date;
    if (!date) {
      if (row.week === null) {
        rowIssues.push(
          error(
            row.weekLabel ? `Semaine « ${row.weekLabel} » invalide.` : "Indiquez la semaine.",
            "date",
          ),
        );
      }
      if (row.dayOffset === null) {
        rowIssues.push(
          error(row.dayLabel ? `Jour « ${row.dayLabel} » inconnu.` : "Indiquez le jour.", "date"),
        );
      }
      if (row.week !== null && row.dayOffset !== null) {
        if (!startDate)
          rowIssues.push(
            error("Date de début de la campagne manquante (onglet Campagne).", "date"),
          );
        else date = fromWeekDayLocal(startDate, row.week, row.dayOffset);
      }
    }
    let time = o.time && isTime(o.time) ? o.time : row.time;
    if (!time) {
      if (row.timeLabel)
        rowIssues.push(error(`Heure « ${row.timeLabel} » invalide (format 09:00).`, "time"));
      else rowIssues.push(warning("Heure manquante : 09:00 par défaut.", "time"));
      time = DEFAULT_TIME;
    }
    const scheduled = date ? localToUtc(date, time, tz) : null;
    if (scheduled && !row.published && scheduled.getTime() <= now.getTime()) {
      rowIssues.push(error("Cette date est passée : choisissez une date à venir.", "date"));
    }
    if (row.statusPublished && !row.published) {
      rowIssues.push(
        warning(
          "Statut « Publié » sans lien valide : le post est importé comme à publier.",
          "status",
        ),
      );
    }

    // Link to
    let linkToCode: string | null = null;
    let linkToUrl: string | null = null;
    if (row.linkTo) {
      if (isUrl(row.linkTo)) linkToUrl = row.linkTo;
      else {
        const target = row.linkTo.toUpperCase();
        if (contents.has(target)) linkToCode = target;
        else rowIssues.push(error(`« Lien vers » ${row.linkTo} : contenu inconnu.`, "linkTo"));
      }
    }

    // Text
    const body = row.body;
    if (platform === "LINKEDIN" && body.length > LIMITS.linkedinBody) {
      rowIssues.push(
        error(
          `Texte trop long pour LinkedIn (${body.length} / ${LIMITS.linkedinBody} caractères).`,
          "body",
        ),
      );
    }

    // Relays
    const relays: PreviewPost["relays"] = [];
    for (const relayName of row.relayNames) {
      const p = person(relayName);
      if (typeof p === "string") {
        rowIssues.push(
          warning(`${personIssue(relayName, p, "Relais")} Mission ignorée.`, "relays"),
        );
        continue;
      }
      const isAuthor = publisher?.kind === "contributor" && publisher.name === p.name;
      if (!isAuthor && !relays.some((r) => r.name === p.name))
        relays.push({ name: p.name, contributorId: p.id, key: p.key });
    }

    return {
      row: row.row,
      skip: o.skip === true,
      date,
      time,
      scheduledAt: scheduled ? scheduled.toISOString() : null,
      publisher,
      accountLabel: row.account,
      format,
      contentCode: content ? code : null,
      contentTitle: content?.title ?? null,
      linkToCode,
      linkToUrl,
      angle: row.angle,
      body,
      relays,
      published: row.published,
      publishedUrl: row.published ? row.publishedUrl : null,
      issues: o.skip ? [] : rowIssues,
    };
  });

  const active = posts.filter((p) => !p.skip);
  const all = [...issues, ...active.flatMap((p) => p.issues)];
  return {
    campaign: {
      name,
      startDate,
      objective: c.objective || null,
      audience: c.audience || null,
      brief: c.brief || null,
      mainContentCode,
    },
    contents: [...contents.values()].filter(
      (item) => !item.existing || parsed.contents.some((p) => p.code === item.code),
    ),
    newContributors: [...newContributors.values()],
    posts,
    issues,
    counts: {
      posts: active.length,
      skipped: posts.length - active.length,
      errors: all.filter((i) => i.level === "error").length,
      warnings: all.filter((i) => i.level === "warning").length,
      missions: active.reduce(
        (n, p) => n + p.relays.length + (p.publisher?.kind === "contributor" ? 1 : 0),
        0,
      ),
      withText: active.filter((p) => cleanText(p.body) !== "").length,
      published: active.filter((p) => p.published).length,
    },
  };
}

/** Week + day → local date "yyyy-MM-dd" (the time is applied separately, DST-safe). */
function fromWeekDayLocal(startDate: string, week: number, dayOffset: number): string {
  // fromWeekDay works in local wall-clock time; noon avoids any date shift.
  const instant = fromWeekDay(startDate, week, dayOffset, "12:00", "UTC");
  return instant.toISOString().slice(0, 10);
}
