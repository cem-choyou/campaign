import "server-only";
import ExcelJS from "exceljs";
import { normalizeHex, readableOn } from "@/lib/color";
import { CONTENT_TYPE_LABELS, DAYS, FORMAT_LABELS, type ContentType } from "@/lib/import/normalize";
import type { Platform, PostFormat, PublishMode } from "@/lib/posts";

// The campaign workbook (§12), generated with exceljs: same tabs, columns, colours, formulas and
// drop-down lists as docs/templates/modele-campagne.xlsx, pre-filled with the brand's accounts
// and contributors. The optional campaign data makes the same builder serve the export (lot 3).

export type TemplateInput = {
  brand: { name: string; color: string };
  accounts: { name: string; platform: Platform; publishMode: PublishMode }[];
  contributors: {
    firstName: string;
    lastName: string | null;
    email: string;
    jobTitle: string | null;
    linkedinUrl: string | null;
    toneNote: string | null;
  }[];
  campaign?: {
    name: string;
    startDate: string | null;
    objective: string | null;
    audience: string | null;
    brief: string | null;
    mainContentCode: string | null;
  };
  contents?: {
    code: string;
    type: ContentType;
    title: string;
    mediaUrl: string | null;
    durationSec: number | null;
    summary: string | null;
    youtubeUrl: string | null;
  }[];
  posts?: {
    week: number;
    day: number;
    time: string;
    account: string;
    format: PostFormat;
    contentCode: string | null;
    linkTo: string | null;
    angle: string | null;
    body: string | null;
    relays: string[];
    status: string;
    publishedUrl: string | null;
  }[];
};

const COLORS = {
  input: "FFFFF4CC", // yellow: to fill in
  inputFont: "FF0000FF", // blue text
  computed: "FFEDEDED", // grey: formula, do not edit
  app: "FFDDEBF7", // light blue: filled by Campaign
};

const PLANNING_ROWS = 60;
const CONTENT_ROWS = 40;
const CONTRIBUTOR_ROWS = 30;

type Style = "input" | "computed" | "app";

function argb(hex: string) {
  return `FF${hex.replace("#", "").toUpperCase()}`;
}

function styleCell(cell: ExcelJS.Cell, style: Style) {
  cell.font = {
    size: 10,
    color: { argb: style === "input" ? COLORS.inputFont : "FF000000" },
  };
  cell.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: {
      argb: style === "input" ? COLORS.input : style === "computed" ? COLORS.computed : COLORS.app,
    },
  };
  cell.alignment = { vertical: "top", wrapText: true };
}

function header(sheet: ExcelJS.Worksheet, labels: string[], widths: number[], color: string) {
  const fill = normalizeHex(color) ?? "#1F3A5F";
  const text = readableOn(fill);
  sheet.columns = labels.map((_, i) => ({ width: widths[i] }));
  const row = sheet.getRow(1);
  labels.forEach((label, i) => {
    const cell = row.getCell(i + 1);
    cell.value = label;
    cell.font = { bold: true, size: 10, color: { argb: argb(text) } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: argb(fill) } };
    cell.alignment = { vertical: "middle", wrapText: true };
  });
  row.height = 28;
}

/**
 * Data validation on a whole range. Setting it cell by cell makes exceljs write overlapping ranges
 * (it sorts addresses as text: B10 before B2), which Excel then offers to « repair ». The range
 * API exists at runtime but is missing from exceljs' types.
 */
function validate(sheet: ExcelJS.Worksheet, range: string, validation: ExcelJS.DataValidation) {
  (
    sheet as unknown as {
      dataValidations: { add: (range: string, v: ExcelJS.DataValidation) => void };
    }
  ).dataValidations.add(range, validation);
}

function list(sheet: ExcelJS.Worksheet, range: string, formula: string) {
  validate(sheet, range, {
    type: "list",
    allowBlank: true,
    formulae: [formula],
    showErrorMessage: false,
  });
}

function modeLabel(account: TemplateInput["accounts"][number]) {
  if (account.publishMode === "AUTO") return "Auto";
  if (account.publishMode === "STUDIO") return "Studio";
  return "Kit";
}

function durationText(sec: number | null) {
  if (!sec) return null;
  return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, "0")}`;
}

export function buildCampaignWorkbook(input: TemplateInput): ExcelJS.Workbook {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Campaign · ChoYou";
  wb.created = new Date();
  const color = input.brand.color;

  // ---------- Lisez-moi ----------
  const readme = wb.addWorksheet("Lisez-moi");
  readme.columns = [{ width: 4 }, { width: 100 }];
  const lines: [string, "title" | "h" | "p"][] = [
    ["Modèle de campagne multi-canal — import dans Campaign", "title"],
    ["", "p"],
    ["Comment remplir", "h"],
    [
      "1. Onglet Campagne : nom, date du lundi de la semaine 1, objectif, cible et brief (le brief sert de contexte à l'IA pour tous les posts).",
      "p",
    ],
    [
      "2. Onglet Contenus : une ligne par vidéo, capsule ou visuel, décrit UNE seule fois. L'ID (ex. CAP1) est réutilisé dans le planning.",
      "p",
    ],
    [
      "3. Onglet Planning : une ligne par publication. Choisir la semaine, le jour, le compte, le format et l'ID du contenu. Heure vide = 09:00.",
      "p",
    ],
    [
      "4. Colonne « Texte du post » : laisser vide pour que l'IA le rédige ; la remplir pour imposer un texte.",
      "p",
    ],
    [
      "5. Onglet Relais : les collaborateurs qui postent ou relaient (prénom et e-mail obligatoires).",
      "p",
    ],
    ["", "p"],
    ["Code couleur", "h"],
    ["Jaune, texte bleu = cellule à remplir", "p"],
    ["Gris = calculé automatiquement, ne pas modifier (sauf pour imposer une date précise)", "p"],
    ["Bleu clair = rempli par Campaign (statut, lien publié)", "p"],
    ["", "p"],
    ["Modes de publication", "h"],
    ["Auto = publié par Campaign après validation (pages LinkedIn, bientôt).", "p"],
    [
      "Kit = une personne publie sur la page avec le kit envoyé par Campaign (texte, média, démarche).",
      "p",
    ],
    [
      "Studio = programmé à la main dans YouTube Studio ; Campaign fournit titre et description et suit la mise en ligne.",
      "p",
    ],
    [
      "Relais = profil personnel : la personne reçoit un e-mail la veille et le jour J avec un lien vers son kit, et publie elle-même.",
      "p",
    ],
    ["", "p"],
    ["Relais équipe", "h"],
    [
      "Pour qu'un collaborateur POSTE depuis son profil, choisir son nom dans la colonne Compte du planning.",
      "p",
    ],
    [
      "Pour qu'il RELAIE un post de la page, écrire son nom dans « Relayé par », plusieurs noms séparés par des virgules.",
      "p",
    ],
  ];
  lines.forEach(([text, kind], i) => {
    const cell = readme.getCell(i + 1, 2);
    cell.value = text || null;
    cell.alignment = { wrapText: true, vertical: "top" };
    cell.font =
      kind === "title"
        ? { bold: true, size: 14, color: { argb: argb(normalizeHex(color) ?? "#1F3A5F") } }
        : kind === "h"
          ? { bold: true, size: 11, color: { argb: argb(normalizeHex(color) ?? "#1F3A5F") } }
          : { size: 10 };
  });

  // ---------- Campagne ----------
  const campaignSheet = wb.addWorksheet("Campagne");
  header(campaignSheet, ["Champ", "Valeur"], [26, 80], color);
  const c = input.campaign;
  const fields: [string, unknown][] = [
    ["Marque", input.brand.name],
    ["Nom de la campagne", c?.name ?? null],
    ["Date de début (lundi S1)", c?.startDate ? new Date(`${c.startDate}T00:00:00Z`) : null],
    ["Objectif", c?.objective ?? null],
    ["Cible", c?.audience ?? null],
    ["Brief pour l'IA", c?.brief ?? null],
    ["ID de la vidéo principale", c?.mainContentCode ?? null],
  ];
  fields.forEach(([label, value], i) => {
    const row = campaignSheet.getRow(i + 2);
    row.getCell(1).value = label;
    row.getCell(1).font = { bold: true, size: 10 };
    const cell = row.getCell(2);
    cell.value = value as ExcelJS.CellValue;
    styleCell(cell, "input");
    if (label.startsWith("Date")) cell.numFmt = "dd/mm/yyyy";
  });

  // Accounts and contributors offered in the planning's « Compte » list (Listes sheet, built last).
  const publishers = [
    ...input.accounts.map((a) => ({
      name: a.name,
      network: a.platform === "LINKEDIN" ? "LinkedIn" : "YouTube",
      type: a.platform === "LINKEDIN" ? "Page entreprise" : "Chaîne",
      mode: modeLabel(a),
    })),
    ...input.contributors.map((p) => ({
      name: `${p.firstName} ${p.lastName ?? ""}`.trim(),
      network: "LinkedIn",
      type: "Profil personnel",
      mode: "Relais",
    })),
  ];
  // Room for accounts added by hand.
  const lastPublisherRow = Math.max(publishers.length + 11, 12);
  const formatCount = Object.keys(FORMAT_LABELS).length;
  const typeCount = Object.keys(CONTENT_TYPE_LABELS).length;

  // ---------- Contenus ----------
  const contentsSheet = wb.addWorksheet("Contenus", { views: [{ state: "frozen", ySplit: 1 }] });
  header(
    contentsSheet,
    [
      "ID",
      "Type",
      "Titre",
      "Lien média (Frame.io, Drive…)",
      "Durée",
      "Résumé / message clé (pour l'IA)",
      "Lien YouTube (une fois en ligne)",
    ],
    [11, 14, 26, 48, 9, 50, 34],
    color,
  );
  const contents = input.contents ?? [];
  const contentRows = Math.max(CONTENT_ROWS, contents.length + 10);
  for (let r = 2; r <= contentRows + 1; r++) {
    const item = contents[r - 2];
    const row = contentsSheet.getRow(r);
    const values = item
      ? [
          item.code,
          CONTENT_TYPE_LABELS[item.type],
          item.title,
          item.mediaUrl,
          durationText(item.durationSec),
          item.summary,
          item.youtubeUrl,
        ]
      : [null, null, null, null, null, null, null];
    values.forEach((v, i) => {
      const cell = row.getCell(i + 1);
      cell.value = v;
      styleCell(cell, i === 6 ? "app" : "input");
    });
  }
  const lastContentRow = contentRows + 1;
  list(contentsSheet, `B2:B${lastContentRow}`, `Listes!$K$2:$K$${typeCount + 1}`);

  // ---------- Planning ----------
  const planning = wb.addWorksheet("Planning", { views: [{ state: "frozen", ySplit: 1 }] });
  header(
    planning,
    [
      "Semaine",
      "Jour",
      "Date",
      "Heure",
      "Compte",
      "Réseau",
      "Mode",
      "Format",
      "ID contenu",
      "Titre du contenu",
      "Lien vers (ID ou URL)",
      "Sujet / angle",
      "Texte du post (vide = IA)",
      "Relayé par (noms, virgules)",
      "Statut",
      "Lien publié",
    ],
    [9, 11, 12, 8, 26, 10, 9, 13, 11, 22, 16, 34, 40, 26, 12, 30],
    color,
  );
  const posts = input.posts ?? [];
  const planningRows = Math.max(PLANNING_ROWS, posts.length + 20);
  const accountsRange = `Listes!$D$2:$D$${lastPublisherRow}`;
  for (let r = 2; r <= planningRows + 1; r++) {
    const post = posts[r - 2];
    const row = planning.getRow(r);
    const set = (col: number, value: ExcelJS.CellValue, style: Style) => {
      const cell = row.getCell(col);
      cell.value = value;
      styleCell(cell, style);
      return cell;
    };
    set(1, post?.week ?? null, "input");
    set(2, post ? DAYS[post.day] : null, "input");
    set(
      3,
      {
        formula: `IF(OR(A${r}="",B${r}=""),"",Campagne!$B$4+(A${r}-1)*7+INDEX(Listes!$B$2:$B$8,MATCH(B${r},Listes!$A$2:$A$8,0)))`,
      },
      "computed",
    ).numFmt = "ddd dd/mm/yy";
    const [h, m] = (post?.time ?? "").split(":").map(Number);
    set(4, post ? new Date(Date.UTC(1899, 11, 30, h ?? 9, m ?? 0)) : null, "input").numFmt =
      "hh:mm";
    set(5, post?.account ?? null, "input");
    set(
      6,
      {
        formula: `IF(E${r}="","",IFERROR(INDEX(Listes!$E$2:$E$${lastPublisherRow},MATCH(E${r},${accountsRange},0)),"?"))`,
      },
      "computed",
    );
    set(
      7,
      {
        formula: `IF(E${r}="","",IFERROR(INDEX(Listes!$G$2:$G$${lastPublisherRow},MATCH(E${r},${accountsRange},0)),"?"))`,
      },
      "computed",
    );
    set(8, post ? FORMAT_LABELS[post.format] : null, "input");
    set(9, post?.contentCode ?? null, "input");
    set(
      10,
      {
        formula: `IF(I${r}="","",IFERROR(INDEX(Contenus!$C$2:$C$${lastContentRow},MATCH(I${r},Contenus!$A$2:$A$${lastContentRow},0)),"ID inconnu"))`,
      },
      "computed",
    );
    set(11, post?.linkTo ?? null, "input");
    set(12, post?.angle ?? null, "input");
    set(13, post?.body ?? null, "input");
    set(14, post?.relays.length ? post.relays.join(", ") : null, "input");
    set(15, post?.status ?? null, "app");
    set(16, post?.publishedUrl ?? null, "app");
  }
  const last = planningRows + 1;
  validate(planning, `A2:A${last}`, {
    type: "whole",
    operator: "greaterThanOrEqual",
    allowBlank: true,
    formulae: [1],
    showErrorMessage: true,
    errorTitle: "Semaine",
    error: "Indiquez un numéro de semaine : 1, 2, 3…",
  });
  list(planning, `B2:B${last}`, "Listes!$A$2:$A$8");
  list(planning, `E2:E${last}`, accountsRange);
  list(planning, `H2:H${last}`, `Listes!$I$2:$I$${formatCount + 1}`);
  list(planning, `I2:I${last}`, `Contenus!$A$2:$A$${lastContentRow}`);
  planning.autoFilter = { from: "A1", to: `P${last}` };

  // ---------- Relais ----------
  const relays = wb.addWorksheet("Relais", { views: [{ state: "frozen", ySplit: 1 }] });
  header(
    relays,
    [
      "Prénom",
      "Nom",
      "E-mail",
      "Poste",
      "URL profil LinkedIn",
      "Ton / style (pour l'IA)",
      "Nom dans le planning",
    ],
    [14, 16, 30, 22, 36, 40, 22],
    color,
  );
  const people = input.contributors;
  const peopleRows = Math.max(CONTRIBUTOR_ROWS, people.length + 10);
  for (let r = 2; r <= peopleRows + 1; r++) {
    const p = people[r - 2];
    const row = relays.getRow(r);
    const values = p
      ? [p.firstName, p.lastName, p.email, p.jobTitle, p.linkedinUrl, p.toneNote]
      : [null, null, null, null, null, null];
    values.forEach((v, i) => {
      const cell = row.getCell(i + 1);
      cell.value = v;
      styleCell(cell, "input");
    });
    const name = row.getCell(7);
    name.value = { formula: `IF(A${r}="","",TRIM(A${r}&IF(B${r}="",""," "&B${r})))` };
    styleCell(name, "computed");
  }

  // ---------- Listes ----------
  const lists = wb.addWorksheet("Listes");
  header(
    lists,
    [
      "Jour",
      "Décalage (jours)",
      "",
      "Compte",
      "Réseau",
      "Type",
      "Mode de publication",
      "",
      "Format",
      "",
      "Type de contenu",
      "",
      "Réseau",
    ],
    [12, 16, 3, 28, 12, 18, 20, 3, 16, 3, 16, 3, 12],
    color,
  );
  for (const col of [3, 8, 10, 12]) {
    const cell = lists.getRow(1).getCell(col);
    cell.value = null;
    cell.fill = { type: "pattern", pattern: "none" };
  }
  DAYS.forEach((day, i) => {
    lists.getCell(i + 2, 1).value = day;
    lists.getCell(i + 2, 2).value = i;
  });
  publishers.forEach((p, i) => {
    lists.getCell(i + 2, 4).value = p.name;
    lists.getCell(i + 2, 5).value = p.network;
    lists.getCell(i + 2, 6).value = p.type;
    lists.getCell(i + 2, 7).value = p.mode;
  });
  const firstFree = publishers.length + 2;
  list(lists, `E${firstFree}:E${lastPublisherRow}`, "$M$2:$M$3");
  list(lists, `G${firstFree}:G${lastPublisherRow}`, '"Auto,Kit,Studio,Relais"');
  Object.values(FORMAT_LABELS).forEach((label, i) => (lists.getCell(i + 2, 9).value = label));
  Object.values(CONTENT_TYPE_LABELS).forEach(
    (label, i) => (lists.getCell(i + 2, 11).value = label),
  );
  lists.getCell(2, 13).value = "LinkedIn";
  lists.getCell(3, 13).value = "YouTube";
  return wb;
}

export async function workbookBuffer(wb: ExcelJS.Workbook): Promise<Buffer> {
  return Buffer.from(await wb.xlsx.writeBuffer());
}
