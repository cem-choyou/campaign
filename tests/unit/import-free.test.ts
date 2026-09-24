import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  buildFreeWorkbook,
  distinctValues,
  guessAccount,
  guessContent,
  guessInterpretation,
  guessMapping,
} from "@/lib/import/free";
import { resolveImport } from "@/lib/import/resolve";
import { isTemplate, readGrid, readWorkbook } from "@/server/import/parse";

// The original LDDLT plan (free-form, before the template existed).
async function lddltGrid() {
  const buffer = readFileSync("tests/fixtures/plan-lddlt-original.xlsx");
  const workbook = await readWorkbook(
    buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) as ArrayBuffer,
  );
  return { workbook, grid: readGrid(workbook)! };
}

const publishers = [
  { name: "IT for Business", platform: "LINKEDIN" as const },
  { name: "IT for Business YouTube", platform: "YOUTUBE" as const },
  { name: "Anne Laure", platform: "LINKEDIN" as const },
];

describe("free-form import (plan LDDLT d'origine)", () => {
  it("reads the grid", async () => {
    const { workbook, grid } = await lddltGrid();
    expect(isTemplate(workbook)).toBe(false);
    expect(grid.headers).toEqual([
      "Semaine",
      "Jour",
      "Canal",
      "Compte",
      "Format",
      "Statut",
      "Lien de publication / Notes",
    ]);
    expect(grid.rows).toHaveLength(18);
    expect(grid.rows[0]!.cells.slice(0, 5)).toEqual([
      "Semaine 1",
      "Lundi",
      "LinkedIn",
      "ITforBusiness",
      "Capsule 1",
    ]);
  });

  it("guesses the column mapping", async () => {
    const { grid } = await lddltGrid();
    expect(guessMapping(grid)).toEqual([
      "week",
      "day",
      "network",
      "account",
      "content", // « Format » holds « Capsule 1 », « Short 1 (…) »
      "status",
      "contentMedia", // Frame.io links
    ]);
  });

  it("interprets contents and accounts", () => {
    expect(guessContent("Capsule 1")).toMatchObject({
      code: "CAP1",
      type: "CAPSULE",
      format: "VIDEO_POST",
    });
    expect(guessContent("Short 3 (Renvoi vers longue vidéo)")).toMatchObject({
      code: "SHORT3",
      type: "SHORT",
      title: "Short 3",
      linkToCode: "VID-LONG",
    });
    expect(guessContent("Webinaire")).toBeNull();
    expect(guessAccount("Shorts", "YouTube", publishers)).toBe("IT for Business YouTube");
    expect(guessAccount("ITforBusiness", "LinkedIn", publishers)).toBe("IT for Business");
    expect(guessAccount("Inconnu", "LinkedIn", publishers)).toBeNull();
  });

  it("becomes 18 posts with their contents, the published history and the long video", async () => {
    const { grid } = await lddltGrid();
    const mapping = guessMapping(grid);
    const values = distinctValues(grid, mapping);
    const parsed = buildFreeWorkbook(
      grid,
      mapping,
      guessInterpretation(values.contents, values.accounts, publishers),
      { name: "Plan LDDLT", startDate: "2026-10-05" },
    );
    expect(parsed.contents.map((c) => c.code).sort()).toEqual(
      [
        "CAP1",
        "CAP2",
        "CAP3",
        "CAP4",
        "CAP5",
        "CAP6",
        "SHORT1",
        "SHORT2",
        "SHORT3",
        "SHORT4",
        "SHORT5",
        "SHORT6",
        "VID-LONG",
      ].sort(),
    );
    expect(parsed.contents.find((c) => c.code === "CAP1")!.mediaUrl).toMatch(
      /^https:\/\/next\.frame\.io/,
    );
    expect(parsed.campaign.mainContentCode).toBe("VID-LONG");

    const preview = resolveImport(
      parsed,
      {
        name: "IT for Business",
        timezone: "Europe/Paris",
        accounts: [
          { id: "page", name: "IT for Business", platform: "LINKEDIN" },
          { id: "yt", name: "IT for Business YouTube", platform: "YOUTUBE" },
        ],
        contributors: [
          { id: "al", firstName: "Anne Laure", lastName: null, email: "al@example.org" },
        ],
        campaign: null,
        canCreateContributors: false,
      },
      {},
      new Date("2026-09-24T10:00:00Z"),
    );
    expect(preview.issues).toEqual([]);
    expect(preview.counts).toMatchObject({ posts: 18, errors: 0, published: 1 });
    const short = preview.posts[2]!;
    expect(short).toMatchObject({ format: "SHORT", contentCode: "SHORT1", linkToCode: "VID-LONG" });
    expect(short.publisher).toMatchObject({ id: "yt" });
    // « https://lnkd.in/… » in the status column: published by Anne Laure, kept as history.
    expect(preview.posts[1]).toMatchObject({
      published: true,
      publishedUrl: "https://lnkd.in/p/e3Aw4K5d",
    });
    // Missing times default to 09:00 (warnings, not errors).
    expect(preview.counts.warnings).toBe(18);
  });
});
