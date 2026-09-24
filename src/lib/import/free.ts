// Free-form spreadsheets (§8.8 step 3): a plain grid, a column → field mapping (proposed by the
// AI, confirmed by the user) and an interpretation of the values (« Capsule 1 » → CAP1…), turned
// into the same ParsedWorkbook as the template. The heuristics below are the AI's fallback and
// the e2e mock, so the feature still works when the AI is unavailable.

import type { PostFormat } from "@/lib/posts";
import {
  type ContentType,
  cleanText,
  isPublishedStatus,
  isUrl,
  normalizeKey,
  parseDateCell,
  parseDay,
  parseFormat,
  parseTime,
  parseWeek,
  splitNames,
} from "./normalize";
import type { ParsedContent, ParsedRow, ParsedWorkbook } from "./types";

export type Grid = {
  sheet: string;
  /** Excel row number of the header row. */
  headerRow: number;
  headers: string[];
  rows: { row: number; cells: string[] }[];
};

export const MAPPING_FIELDS = [
  "ignore",
  "week",
  "day",
  "date",
  "time",
  "account",
  "network",
  "format",
  "content",
  "contentMedia",
  "linkTo",
  "angle",
  "body",
  "relays",
  "status",
  "publishedUrl",
] as const;

export type MappingField = (typeof MAPPING_FIELDS)[number];

export const MAPPING_LABELS: Record<MappingField, string> = {
  ignore: "Ignorer",
  week: "Semaine",
  day: "Jour",
  date: "Date",
  time: "Heure",
  account: "Compte",
  network: "Réseau",
  format: "Format",
  content: "Contenu",
  contentMedia: "Lien du média",
  linkTo: "Lien vers",
  angle: "Sujet / angle",
  body: "Texte du post",
  relays: "Relayé par",
  status: "Statut",
  publishedUrl: "Lien publié",
};

/** Column index (0-based) → field. */
export type Mapping = MappingField[];

const HEADER_HINTS: [MappingField, string[]][] = [
  ["week", ["semaine", "week", "sem"]],
  ["day", ["jour", "day"]],
  ["date", ["date"]],
  ["time", ["heure", "horaire", "time"]],
  ["network", ["canal", "reseau", "plateforme", "network", "channel"]],
  ["account", ["compte", "page", "auteur", "publiepar", "account"]],
  ["relays", ["relaye", "relais", "ambassadeur"]],
  ["format", ["format", "type"]],
  ["content", ["contenu", "video", "capsule", "media", "content"]],
  ["linkTo", ["lienvers", "renvoi"]],
  ["angle", ["sujet", "angle", "theme", "idee"]],
  ["body", ["texte", "text", "wording", "copy", "message"]],
  ["status", ["statut", "status", "etat"]],
  ["publishedUrl", ["lienpublie", "lienpublication", "url"]],
  ["contentMedia", ["lien", "link", "frame", "drive", "notes"]],
];

function looksLike(values: string[], test: (v: string) => boolean) {
  const filled = values.filter(Boolean);
  return filled.length > 0 && filled.filter(test).length / filled.length >= 0.6;
}

/** Heuristic mapping from the headers and a sample of values. */
export function guessMapping(grid: Grid): Mapping {
  const used = new Set<MappingField>();
  return grid.headers.map((header, col) => {
    const key = normalizeKey(header);
    const values = grid.rows.slice(0, 30).map((r) => r.cells[col] ?? "");
    let field: MappingField = "ignore";
    // Content column: « Capsule 1 », « Short 2 (…) » even when headed « Format ».
    if (
      looksLike(
        values,
        (v) => /\b(capsule|short|vid[ée]o|teaser|extrait)\b\s*\d*/i.test(v) && !parseFormat(v),
      )
    ) {
      field = "content";
    } else {
      for (const [candidate, hints] of HEADER_HINTS) {
        if (hints.some((h) => key.startsWith(h) || key.includes(h))) {
          field = candidate;
          break;
        }
      }
    }
    if (field === "ignore" && looksLike(values, (v) => parseDay(v) !== null)) field = "day";
    if (field === "ignore" && looksLike(values, (v) => /semaine|^s\d+$/i.test(v))) field = "week";
    if (field === "contentMedia" && looksLike(values, (v) => /lnkd\.in|linkedin\.com/i.test(v))) {
      field = "publishedUrl";
    }
    if (field !== "ignore" && used.has(field)) field = "ignore";
    if (field !== "ignore") used.add(field);
    return field;
  });
}

// ---------- Values ----------

export type ContentInterpretation = {
  value: string;
  code: string;
  type: ContentType;
  title: string;
  format: PostFormat | null;
  linkToCode: string | null;
};

export type AccountInterpretation = { value: string; match: string | null };

export type Interpretation = {
  contents: ContentInterpretation[];
  accounts: AccountInterpretation[];
};

const CONTENT_PATTERNS: {
  re: RegExp;
  type: ContentType;
  prefix: string;
  label: string;
  format: PostFormat;
}[] = [
  {
    re: /\bcapsule\s*(\d+)/i,
    type: "CAPSULE",
    prefix: "CAP",
    label: "Capsule",
    format: "VIDEO_POST",
  },
  { re: /\bshorts?\s*(\d+)/i, type: "SHORT", prefix: "SHORT", label: "Short", format: "SHORT" },
  { re: /\bteaser\s*(\d*)/i, type: "SHORT", prefix: "TEASER", label: "Teaser", format: "SHORT" },
  {
    re: /\bvisuel\s*(\d*)|\bimage\s*(\d*)/i,
    type: "IMAGE",
    prefix: "IMG",
    label: "Visuel",
    format: "IMAGE",
  },
  {
    re: /\b(?:vid[ée]o\s*longue|longue\s*vid[ée]o|film)\b/i,
    type: "LONG_VIDEO",
    prefix: "VID-LONG",
    label: "Vidéo longue",
    format: "LONG_VIDEO",
  },
];

/** « Capsule 1 » → CAP1; « Short 1 (Renvoi vers longue vidéo) » → SHORT1 linking to VID-LONG. */
export function guessContent(value: string): ContentInterpretation | null {
  const text = cleanText(value);
  for (const p of CONTENT_PATTERNS) {
    const m = p.re.exec(text);
    if (!m) continue;
    const n = m.slice(1).find((g) => g) ?? "";
    const code = p.type === "LONG_VIDEO" ? p.prefix : `${p.prefix}${n}`;
    const refersToLong =
      p.type !== "LONG_VIDEO" && /longue\s*vid[ée]o|vid[ée]o\s*longue|version\s*longue/i.test(text);
    return {
      value,
      code,
      type: p.type,
      title: p.type === "LONG_VIDEO" ? p.label : `${p.label} ${n}`.trim(),
      format: p.format,
      linkToCode: refersToLong ? "VID-LONG" : null,
    };
  }
  return null;
}

/**
 * Account labels the tolerant match cannot resolve: « Shorts » next to « YouTube » in the network
 * column → the brand's only YouTube account.
 */
export function guessAccount(
  label: string,
  network: string,
  publishers: { name: string; platform: "LINKEDIN" | "YOUTUBE" }[],
): string | null {
  const key = normalizeKey(label);
  const exact = publishers.find((p) => normalizeKey(p.name) === key);
  if (exact) return exact.name;
  const net = normalizeKey(network);
  const platform =
    net.includes("youtube") || /short|youtube|chaine/i.test(label)
      ? "YOUTUBE"
      : net.includes("linkedin")
        ? "LINKEDIN"
        : null;
  const candidates = publishers.filter((p) => !platform || p.platform === platform);
  const close = candidates.filter((p) => {
    const k = normalizeKey(p.name);
    return key.length >= 3 && (k.includes(key) || key.includes(k));
  });
  if (close.length === 1) return close[0]!.name;
  if (platform === "YOUTUBE" && candidates.length === 1) return candidates[0]!.name;
  return null;
}

export function guessInterpretation(
  contentValues: string[],
  accountValues: { label: string; network: string }[],
  publishers: { name: string; platform: "LINKEDIN" | "YOUTUBE" }[],
): Interpretation {
  return {
    contents: contentValues.flatMap((v) => guessContent(v) ?? []),
    accounts: accountValues.map((a) => ({
      value: a.label,
      match: guessAccount(a.label, a.network, publishers),
    })),
  };
}

/** Distinct values the interpretation step needs (content labels, account + network pairs). */
export function distinctValues(grid: Grid, mapping: Mapping) {
  const col = (field: MappingField) => mapping.indexOf(field);
  const contentCol = col("content");
  const accountCol = col("account");
  const networkCol = col("network");
  const contents = new Set<string>();
  const accounts = new Map<string, string>();
  for (const r of grid.rows) {
    if (contentCol >= 0 && r.cells[contentCol]) contents.add(r.cells[contentCol]!);
    if (accountCol >= 0 && r.cells[accountCol] && !accounts.has(r.cells[accountCol]!)) {
      accounts.set(r.cells[accountCol]!, networkCol >= 0 ? (r.cells[networkCol] ?? "") : "");
    }
  }
  return {
    contents: [...contents],
    accounts: [...accounts].map(([label, network]) => ({ label, network })),
  };
}

// ---------- Grid → parsed workbook ----------

export function buildFreeWorkbook(
  grid: Grid,
  mapping: Mapping,
  interpretation: Interpretation,
  campaign: { name: string; startDate: string | null },
): ParsedWorkbook {
  const col = (field: MappingField) => mapping.indexOf(field);
  const get = (cells: string[], field: MappingField) => {
    const i = col(field);
    return i >= 0 ? (cells[i] ?? "") : "";
  };
  const contentByValue = new Map(interpretation.contents.map((c) => [c.value, c]));
  const accountByValue = new Map(interpretation.accounts.map((a) => [a.value, a.match]));

  const contents = new Map<string, ParsedContent>();
  const addContent = (code: string, type: ContentType, title: string) => {
    if (!contents.has(code)) {
      contents.set(code, {
        row: 0,
        code,
        type,
        typeLabel: "",
        title,
        mediaUrl: "",
        durationSec: null,
        summary: "",
        youtubeUrl: "",
      });
    }
    return contents.get(code)!;
  };

  const rows: ParsedRow[] = grid.rows.map(({ row, cells }) => {
    const contentLabel = get(cells, "content");
    const content = contentByValue.get(contentLabel) ?? null;
    if (content) {
      const entry = addContent(content.code, content.type, content.title);
      const media = get(cells, "contentMedia");
      if (!entry.mediaUrl && isUrl(media)) entry.mediaUrl = media;
    }
    if (content?.linkToCode && !contents.has(content.linkToCode)) {
      addContent(
        content.linkToCode,
        "LONG_VIDEO",
        content.linkToCode === "VID-LONG" ? "Vidéo longue" : content.linkToCode,
      );
    }

    // A status cell holding a link means « published, here is the link » (LDDLT habit).
    const status = get(cells, "status");
    const publishedUrl = isUrl(get(cells, "publishedUrl"))
      ? get(cells, "publishedUrl")
      : isUrl(status)
        ? status
        : "";
    const statusPublished = isPublishedStatus(status) || isUrl(status);

    const accountLabel = get(cells, "account");
    const formatLabel = get(cells, "format");
    const explicitFormat = parseFormat(formatLabel);
    const time = get(cells, "time");
    return {
      row,
      week: parseWeek(get(cells, "week")),
      weekLabel: get(cells, "week"),
      dayOffset: parseDay(get(cells, "day")),
      dayLabel: get(cells, "day"),
      date: parseDateCell(get(cells, "date")),
      time: parseTime(time),
      timeLabel: time,
      account: accountByValue.get(accountLabel) ?? accountLabel,
      format: explicitFormat ?? content?.format ?? null,
      // Only an unrecognised value of the « Format » column is reported (as « format inconnu »).
      formatLabel: explicitFormat || contentByValue.has(formatLabel) ? "" : formatLabel,
      contentCode: content?.code ?? "",
      linkTo: get(cells, "linkTo") || content?.linkToCode || "",
      angle: get(cells, "angle"),
      body: get(cells, "body"),
      relayNames: splitNames(get(cells, "relays")),
      statusPublished,
      published: statusPublished && isUrl(publishedUrl),
      publishedUrl,
    };
  });

  const longVideo = [...contents.values()].find((c) => c.type === "LONG_VIDEO");
  return {
    kind: "free",
    campaign: {
      brand: "",
      name: campaign.name,
      startDate: campaign.startDate,
      objective: "",
      audience: "",
      brief: "",
      mainContentCode: longVideo?.code ?? "",
    },
    contents: [...contents.values()],
    contributors: [],
    rows,
    fileIssues: rows.length === 0 ? ["Le fichier ne contient aucune ligne de planning."] : [],
  };
}
