import "server-only";
import ExcelJS from "exceljs";
import {
  cleanMultiline,
  cleanText,
  isPublishedStatus,
  isUrl,
  normalizeKey,
  parseContentType,
  parseDateCell,
  parseDay,
  parseFormat,
  parseTime,
  parseWeek,
  splitNames,
} from "@/lib/import/normalize";
import type { Grid } from "@/lib/import/free";
import type {
  ParsedCampaign,
  ParsedContent,
  ParsedContributor,
  ParsedRow,
  ParsedWorkbook,
} from "@/lib/import/types";
import { parseDuration } from "@/lib/validations/content";

// Reads a campaign workbook (§12) into plain data. Only values are read: formula cells are
// ignored (the app recomputes dates, networks and titles itself), except when a user typed a
// value over a formula column (e.g. an explicit date).

export const MAX_ROWS = 1000;

type Cell = ExcelJS.Cell;

/** A cell as a plain value; formulas are flagged so the caller can ignore them. */
export function readCell(cell: Cell | undefined): { value: unknown; formula: boolean } {
  const v = cell?.value;
  if (v === null || v === undefined) return { value: null, formula: false };
  if (typeof v === "object" && !(v instanceof Date)) {
    if ("formula" in v || "sharedFormula" in v) {
      return { value: (v as { result?: unknown }).result ?? null, formula: true };
    }
    if ("richText" in v) {
      return { value: v.richText.map((r) => r.text).join(""), formula: false };
    }
    if ("hyperlink" in v) {
      const link = v as { text?: unknown; hyperlink: string };
      const text = typeof link.text === "string" ? link.text : "";
      return { value: isUrl(text) ? text : link.hyperlink || text, formula: false };
    }
    if ("error" in v) return { value: null, formula: true };
  }
  return { value: v, formula: false };
}

function value(cell: Cell | undefined): unknown {
  const read = readCell(cell);
  return read.formula ? null : read.value;
}

function findSheet(workbook: ExcelJS.Workbook, name: string): ExcelJS.Worksheet | undefined {
  const key = normalizeKey(name);
  return workbook.worksheets.find((ws) => normalizeKey(ws.name) === key);
}

/** Column index (1-based) by header text, tolerant to case, accents and extra words. */
function headerMap(sheet: ExcelJS.Worksheet): (...names: string[]) => number | null {
  const headers = new Map<string, number>();
  sheet.getRow(1).eachCell((cell, col) => {
    const key = normalizeKey(cleanText(readCell(cell).value));
    if (key && !headers.has(key)) headers.set(key, col);
  });
  return (...names) => {
    for (const name of names) {
      const key = normalizeKey(name);
      if (headers.has(key)) return headers.get(key)!;
    }
    for (const name of names) {
      const key = normalizeKey(name);
      for (const [header, col] of headers) if (header.startsWith(key)) return col;
    }
    return null;
  };
}

function isEmptyRow(row: ExcelJS.Row, cols: (number | null)[]): boolean {
  return cols.every((c) => c === null || cleanText(value(row.getCell(c))) === "");
}

function durationOf(raw: unknown): number | null {
  if (raw === null || raw === undefined || raw === "") return null;
  if (raw instanceof Date) {
    return raw.getUTCHours() * 3600 + raw.getUTCMinutes() * 60 + raw.getUTCSeconds();
  }
  if (typeof raw === "number") return raw < 1 ? Math.round(raw * 86_400) : Math.round(raw);
  const seconds = parseDuration(String(raw));
  return seconds === null || Number.isNaN(seconds) ? null : seconds;
}

// ---------- Sheets ----------

function parseCampaignSheet(sheet: ExcelJS.Worksheet | undefined): ParsedCampaign {
  const campaign: ParsedCampaign = {
    brand: "",
    name: "",
    startDate: null,
    objective: "",
    audience: "",
    brief: "",
    mainContentCode: "",
  };
  if (!sheet) return campaign;
  sheet.eachRow((row, index) => {
    if (index === 1) return;
    const label = normalizeKey(cleanText(value(row.getCell(1))));
    const raw = value(row.getCell(2));
    if (label.startsWith("marque")) campaign.brand = cleanText(raw);
    else if (label.startsWith("nom")) campaign.name = cleanText(raw);
    else if (label.startsWith("datededebut") || label.startsWith("debut"))
      campaign.startDate = parseDateCell(raw);
    else if (label.startsWith("objectif")) campaign.objective = cleanMultiline(raw);
    else if (label.startsWith("cible")) campaign.audience = cleanMultiline(raw);
    else if (label.startsWith("brief")) campaign.brief = cleanMultiline(raw);
    else if (label.includes("videoprincipale") || label.includes("contenuprincipal"))
      campaign.mainContentCode = cleanText(raw).toUpperCase();
  });
  return campaign;
}

function parseContentsSheet(sheet: ExcelJS.Worksheet | undefined): ParsedContent[] {
  if (!sheet) return [];
  const col = headerMap(sheet);
  const c = {
    code: col("ID", "Code"),
    type: col("Type"),
    title: col("Titre"),
    media: col("Lien média", "Lien media", "Média"),
    duration: col("Durée"),
    summary: col("Résumé", "Message clé"),
    youtube: col("Lien YouTube"),
  };
  const contents: ParsedContent[] = [];
  sheet.eachRow((row, index) => {
    if (index === 1 || isEmptyRow(row, [c.code, c.title])) return;
    const get = (i: number | null) => (i ? value(row.getCell(i)) : null);
    const typeLabel = cleanText(get(c.type));
    contents.push({
      row: index,
      code: cleanText(get(c.code)).toUpperCase(),
      type: parseContentType(typeLabel),
      typeLabel,
      title: cleanText(get(c.title)),
      mediaUrl: cleanText(get(c.media)),
      durationSec: durationOf(get(c.duration)),
      summary: cleanMultiline(get(c.summary)),
      youtubeUrl: cleanText(get(c.youtube)),
    });
  });
  return contents;
}

function parseContributorsSheet(sheet: ExcelJS.Worksheet | undefined): ParsedContributor[] {
  if (!sheet) return [];
  const col = headerMap(sheet);
  const c = {
    firstName: col("Prénom"),
    lastName: col("Nom"),
    email: col("E-mail", "Email", "Adresse e-mail"),
    jobTitle: col("Poste", "Fonction"),
    linkedin: col("URL profil LinkedIn", "Profil LinkedIn", "LinkedIn"),
    tone: col("Ton", "Style"),
  };
  const list: ParsedContributor[] = [];
  sheet.eachRow((row, index) => {
    if (index === 1 || isEmptyRow(row, [c.firstName, c.email])) return;
    const get = (i: number | null) => (i ? value(row.getCell(i)) : null);
    list.push({
      row: index,
      firstName: cleanText(get(c.firstName)),
      lastName: cleanText(get(c.lastName)),
      email: cleanText(get(c.email)).toLowerCase(),
      jobTitle: cleanText(get(c.jobTitle)),
      linkedinUrl: cleanText(get(c.linkedin)),
      toneNote: cleanMultiline(get(c.tone)),
    });
  });
  return list;
}

function parsePlanningSheet(sheet: ExcelJS.Worksheet): ParsedRow[] {
  const col = headerMap(sheet);
  const c = {
    week: col("Semaine"),
    day: col("Jour"),
    date: col("Date"),
    time: col("Heure"),
    account: col("Compte"),
    format: col("Format"),
    content: col("ID contenu", "Contenu"),
    linkTo: col("Lien vers"),
    angle: col("Sujet", "Angle"),
    body: col("Texte du post", "Texte"),
    relay: col("Relayé par", "Relais"),
    status: col("Statut"),
    published: col("Lien publié"),
  };
  const rows: ParsedRow[] = [];
  sheet.eachRow((row, index) => {
    if (index === 1) return;
    // A row counts only when a user-filled column has something (formulas alone do not).
    if (isEmptyRow(row, [c.week, c.day, c.account, c.format, c.content, c.angle, c.body])) return;
    const get = (i: number | null) => (i ? value(row.getCell(i)) : null);
    const weekRaw = get(c.week);
    const dayRaw = get(c.day);
    const timeRaw = get(c.time);
    const formatLabel = cleanText(get(c.format));
    const statusRaw = get(c.status);
    const publishedUrl = cleanText(get(c.published));
    rows.push({
      row: index,
      week: parseWeek(weekRaw),
      weekLabel: cleanText(weekRaw),
      dayOffset: parseDay(dayRaw),
      dayLabel: cleanText(dayRaw),
      date: parseDateCell(get(c.date)),
      time: parseTime(timeRaw),
      timeLabel: cleanText(timeRaw instanceof Date ? parseTime(timeRaw) : timeRaw),
      account: cleanText(get(c.account)),
      format: parseFormat(formatLabel),
      formatLabel,
      contentCode: cleanText(get(c.content)).toUpperCase(),
      linkTo: cleanText(get(c.linkTo)),
      angle: cleanMultiline(get(c.angle)),
      body: cleanMultiline(get(c.body)),
      relayNames: splitNames(get(c.relay)),
      statusPublished: isPublishedStatus(statusRaw),
      published: isPublishedStatus(statusRaw) && isUrl(publishedUrl),
      publishedUrl,
    });
  });
  return rows;
}

/** Whether a workbook follows the app's template (planning with the expected headers). */
export function isTemplate(workbook: ExcelJS.Workbook): boolean {
  const planning = findSheet(workbook, "Planning");
  if (!planning) return false;
  const col = headerMap(planning);
  return col("Semaine") !== null && col("Jour") !== null && col("Compte") !== null;
}

// ---------- Free-form files ----------

const MAX_COLUMNS = 30;

/** A cell as display text: dates as yyyy-MM-dd, Excel times as HH:mm. */
function cellText(cell: Cell): string {
  const { value: v } = readCell(cell);
  if (v instanceof Date) {
    return v.getUTCFullYear() <= 1900 ? (parseTime(v) ?? "") : v.toISOString().slice(0, 10);
  }
  return cleanMultiline(v);
}

/**
 * The planning of a free-form workbook as a grid: the sheet with the most rows, headers on the
 * first row with at least two filled cells.
 */
export function readGrid(workbook: ExcelJS.Workbook): Grid | null {
  const sheets = workbook.worksheets.filter((ws) => ws.actualRowCount > 1);
  const sheet = sheets.sort((a, b) => b.actualRowCount - a.actualRowCount)[0];
  if (!sheet) return null;

  let headerRow = 0;
  let headers: string[] = [];
  const rows: Grid["rows"] = [];
  sheet.eachRow((row, index) => {
    const width = Math.min(row.cellCount, MAX_COLUMNS);
    const cells = Array.from({ length: width }, (_, i) => cellText(row.getCell(i + 1)));
    const filled = cells.filter(Boolean).length;
    if (!headerRow) {
      if (filled >= 2) {
        headerRow = index;
        headers = cells;
      }
      return;
    }
    if (filled > 0 && rows.length < MAX_ROWS) rows.push({ row: index, cells });
  });
  if (!headerRow) return null;
  // As wide as the widest row, minus trailing columns without a header nor any value.
  let width = Math.max(headers.length, ...rows.map((r) => r.cells.length));
  while (width > 0 && !headers[width - 1] && rows.every((r) => !r.cells[width - 1])) width--;
  return {
    sheet: sheet.name,
    headerRow,
    headers: headers.slice(0, width).map((h, i) => h || `Colonne ${i + 1}`),
    rows: rows.map((r) => ({ row: r.row, cells: r.cells.slice(0, width) })),
  };
}

export async function readWorkbook(buffer: ArrayBuffer): Promise<ExcelJS.Workbook> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);
  return workbook;
}

/** Template workbook → parsed data. Free-form workbooks go through the AI mapping instead. */
export function parseTemplate(workbook: ExcelJS.Workbook): ParsedWorkbook {
  const planning = findSheet(workbook, "Planning")!;
  const rows = parsePlanningSheet(planning);
  const fileIssues: string[] = [];
  if (rows.length === 0) fileIssues.push("L'onglet Planning ne contient aucune publication.");
  if (rows.length > MAX_ROWS) {
    fileIssues.push(`Le planning dépasse ${MAX_ROWS} lignes : découpez-le en plusieurs fichiers.`);
  }
  return {
    kind: "template",
    campaign: parseCampaignSheet(findSheet(workbook, "Campagne")),
    contents: parseContentsSheet(findSheet(workbook, "Contenus")),
    contributors: parseContributorsSheet(findSheet(workbook, "Relais")),
    rows: rows.slice(0, MAX_ROWS),
    fileIssues,
  };
}
