import "server-only";
import { z } from "zod";
import {
  type Grid,
  type Interpretation,
  MAPPING_FIELDS,
  MAPPING_LABELS,
  type Mapping,
  guessContent,
  guessInterpretation,
  guessMapping,
} from "@/lib/import/free";
import { CONTENT_TYPE_LABELS, FORMAT_LABELS, type ContentType } from "@/lib/import/normalize";
import type { PostFormat } from "@/lib/posts";
import { contentCode } from "@/lib/validations/content";
import { AppError } from "@/server/errors";
import { logger } from "@/server/logger";
import { generateObject } from "./client";
import { consumeAi } from "./quota";

// AI help for free-form spreadsheets (§8.8 step 3). Both calls fall back on the heuristics of
// lib/import/free.ts when the AI is unavailable or over quota: the user still gets a proposal
// to confirm, never a dead end.

const SYSTEM =
  "Vous aidez à importer un planning de publications (LinkedIn, YouTube) depuis un tableur. Répondez uniquement avec le JSON demandé.";

type Brand = { id: string; timezone: string };
type Source = "ai" | "heuristic";

function table(grid: Grid, rows = 8) {
  const line = (cells: string[]) =>
    cells.map((c) => c.replace(/\s+/g, " ").slice(0, 60)).join(" | ");
  return [
    line(grid.headers.map((h, i) => `${i}: ${h}`)),
    ...grid.rows.slice(0, rows).map((r) => line(r.cells)),
  ].join("\n");
}

const mappingSchema = z.object({
  columns: z.array(z.object({ column: z.number().int(), field: z.enum(MAPPING_FIELDS) })),
});

export async function suggestMapping(
  grid: Grid,
  brand: Brand,
  userId: string,
): Promise<{ mapping: Mapping; source: Source }> {
  const fallback = guessMapping(grid);
  try {
    await consumeAi(brand, userId);
    const result = await generateObject(
      {
        system: SYSTEM,
        user: [
          "Voici l'en-tête (numéroté) et les premières lignes d'un planning :",
          table(grid),
          "",
          "Associez chaque colonne à un champ :",
          ...MAPPING_FIELDS.map((f) => `- ${f} : ${MAPPING_LABELS[f]}`),
          "",
          "Règles : « content » est le contenu publié (ex. « Capsule 1 », « Short 2 »), même si l'en-tête dit « Format ». « contentMedia » est un lien vers le média (Frame.io, Drive). « status » peut contenir un lien de publication. « network » est le réseau (LinkedIn, YouTube). Chaque champ au plus une fois, sauf « ignore ».",
        ].join("\n"),
      },
      mappingSchema,
      {
        task: "import.mapping",
        effort: "low",
        mock: () => ({ columns: fallback.map((field, column) => ({ column, field })) }),
      },
    );
    const mapping: Mapping = grid.headers.map(() => "ignore");
    const used = new Set<string>();
    for (const { column, field } of result.columns) {
      if (column < 0 || column >= mapping.length || field === "ignore" || used.has(field)) continue;
      mapping[column] = field;
      used.add(field);
    }
    return { mapping, source: "ai" };
  } catch (error) {
    if (!(error instanceof AppError)) throw error;
    logger.warn("import.mapping.fallback", { reason: error.message.slice(0, 80) });
    return { mapping: fallback, source: "heuristic" };
  }
}

const CONTENT_TYPES = Object.keys(CONTENT_TYPE_LABELS) as [ContentType, ...ContentType[]];
const FORMATS = Object.keys(FORMAT_LABELS) as [PostFormat, ...PostFormat[]];

const interpretationSchema = z.object({
  contents: z.array(
    z.object({
      value: z.string(),
      code: z.string(),
      type: z.enum(CONTENT_TYPES),
      title: z.string(),
      format: z.enum(FORMATS).nullable(),
      linkToCode: z.string().nullable(),
    }),
  ),
  accounts: z.array(z.object({ value: z.string(), match: z.string().nullable() })),
});

export async function interpretValues(
  values: { contents: string[]; accounts: { label: string; network: string }[] },
  publishers: { name: string; platform: "LINKEDIN" | "YOUTUBE" }[],
  brand: Brand,
  userId: string,
): Promise<{ interpretation: Interpretation; source: Source }> {
  const fallback = guessInterpretation(values.contents, values.accounts, publishers);
  if (values.contents.length === 0 && values.accounts.length === 0) {
    return { interpretation: fallback, source: "heuristic" };
  }
  try {
    await consumeAi(brand, userId);
    const result = await generateObject(
      {
        system: SYSTEM,
        user: [
          "Comptes et relais de la marque :",
          ...publishers.map(
            (p) => `- ${p.name} (${p.platform === "LINKEDIN" ? "LinkedIn" : "YouTube"})`,
          ),
          "",
          "Valeurs de la colonne « Compte » (avec le réseau indiqué sur la même ligne) :",
          ...values.accounts.map(
            (a) => `- « ${a.label} »${a.network ? ` (réseau : ${a.network})` : ""}`,
          ),
          "Pour chacune, donnez dans « match » le nom exact d'un compte ou relais ci-dessus, ou null si aucun ne correspond.",
          "",
          "Valeurs de la colonne « Contenu » :",
          ...values.contents.map((v) => `- « ${v} »`),
          `Pour chacune : un code court en majuscules (ex. CAP1, SHORT2, VID-LONG), le type (${CONTENT_TYPES.join(", ")}), un titre court, le format de publication (${FORMATS.join(", ")}) ou null, et linkToCode si la valeur renvoie vers un autre contenu (ex. « Renvoi vers longue vidéo » → VID-LONG), sinon null.`,
        ].join("\n"),
      },
      interpretationSchema,
      { task: "import.mapping", effort: "low", mock: () => fallback },
    );
    const byValue = new Map(fallback.contents.map((c) => [c.value, c]));
    // The heuristic fills what the model leaves out (seen live: empty codes, missed « renvoi
    // vers la vidéo longue »), item by item.
    const contents = values.contents.flatMap((value) => {
      const ai = result.contents.find((c) => c.value === value);
      const guess = byValue.get(value) ?? guessContent(value);
      const code = ai ? contentCode.safeParse(ai.code) : null;
      if (ai && code?.success) {
        const link = ai.linkToCode ? contentCode.safeParse(ai.linkToCode) : null;
        return [
          {
            ...ai,
            code: code.data,
            title: ai.title.slice(0, 160),
            linkToCode: link?.success ? link.data : (guess?.linkToCode ?? null),
          },
        ];
      }
      return guess ?? [];
    });
    const names = new Set(publishers.map((p) => p.name));
    const accounts = values.accounts.map(({ label }) => {
      const ai = result.accounts.find((a) => a.value === label);
      const match = ai?.match && names.has(ai.match) ? ai.match : null;
      return {
        value: label,
        match: match ?? fallback.accounts.find((a) => a.value === label)?.match ?? null,
      };
    });
    return { interpretation: { contents, accounts }, source: "ai" };
  } catch (error) {
    if (!(error instanceof AppError)) throw error;
    logger.warn("import.values.fallback", { reason: error.message.slice(0, 80) });
    return { interpretation: fallback, source: "heuristic" };
  }
}
