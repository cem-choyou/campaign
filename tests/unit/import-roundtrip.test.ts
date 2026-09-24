import { describe, expect, it } from "vitest";
import { resolveImport } from "@/lib/import/resolve";
import { buildCampaignWorkbook, workbookBuffer } from "@/server/export/template";
import { isTemplate, parseTemplate, readWorkbook } from "@/server/import/parse";

const brand = {
  name: "IT for Business",
  color: "#1F3A5F",
};
const accounts = [
  { name: "IT for Business", platform: "LINKEDIN" as const, publishMode: "KIT" as const },
  { name: "IT for Business YouTube", platform: "YOUTUBE" as const, publishMode: "STUDIO" as const },
];
const contributors = [
  {
    firstName: "Anne Laure",
    lastName: null,
    email: "anne-laure@example.invalid",
    jobTitle: "DSI",
    linkedinUrl: null,
    toneNote: "Direct",
  },
];

async function roundTrip(input: Parameters<typeof buildCampaignWorkbook>[0]) {
  const buffer = await workbookBuffer(buildCampaignWorkbook(input));
  const workbook = await readWorkbook(
    buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) as ArrayBuffer,
  );
  return { workbook, parsed: parseTemplate(workbook) };
}

describe("generated template", () => {
  it("has the reference tabs, pre-filled with the brand", async () => {
    const { workbook, parsed } = await roundTrip({ brand, accounts, contributors });
    expect(workbook.worksheets.map((w) => w.name)).toEqual([
      "Lisez-moi",
      "Campagne",
      "Contenus",
      "Planning",
      "Relais",
      "Listes",
    ]);
    expect(isTemplate(workbook)).toBe(true);
    const lists = workbook.getWorksheet("Listes")!;
    expect(lists.getCell("D2").value).toBe("IT for Business");
    expect(lists.getCell("G3").value).toBe("Studio");
    expect(lists.getCell("D4").value).toBe("Anne Laure");
    expect(lists.getCell("G4").value).toBe("Relais");
    // Drop-down lists on the planning.
    const planning = workbook.getWorksheet("Planning")!;
    expect(planning.getCell("E2").dataValidation).toMatchObject({ type: "list" });
    expect(planning.getCell("B2").dataValidation?.formulae).toEqual(["Listes!$A$2:$A$8"]);
    expect(parsed.campaign.brand).toBe("IT for Business");
    expect(parsed.contributors).toEqual([
      expect.objectContaining({ firstName: "Anne Laure", email: "anne-laure@example.invalid" }),
    ]);
    // Empty template: nothing to import yet.
    expect(parsed.rows).toEqual([]);
    expect(parsed.fileIssues).toEqual(["L'onglet Planning ne contient aucune publication."]);
  });

  it("reads back what it writes (export → import)", async () => {
    const { parsed } = await roundTrip({
      brand,
      accounts,
      contributors,
      campaign: {
        name: "Promotion vidéo LDDLT",
        startDate: "2026-10-05",
        objective: "Faire voir la vidéo.",
        audience: null,
        brief: "Un brief\nsur deux lignes.",
        mainContentCode: "VID-LONG",
      },
      contents: [
        {
          code: "VID-LONG",
          type: "LONG_VIDEO",
          title: "Vidéo longue",
          mediaUrl: null,
          durationSec: 720,
          summary: null,
          youtubeUrl: null,
        },
        {
          code: "CAP1",
          type: "CAPSULE",
          title: "Capsule 1",
          mediaUrl: "https://frame.io/x",
          durationSec: 95,
          summary: "Trois DSI.",
          youtubeUrl: null,
        },
        {
          code: "SHORT1",
          type: "SHORT",
          title: "Short 1",
          mediaUrl: null,
          durationSec: null,
          summary: null,
          youtubeUrl: null,
        },
      ],
      posts: [
        {
          week: 1,
          day: 0,
          time: "09:00",
          account: "IT for Business",
          format: "VIDEO_POST",
          contentCode: "CAP1",
          linkTo: null,
          angle: "Accroche",
          body: "Texte imposé",
          relays: ["Anne Laure"],
          status: "À faire",
          publishedUrl: null,
        },
        {
          week: 1,
          day: 3,
          time: "18:30",
          account: "IT for Business YouTube",
          format: "SHORT",
          contentCode: "SHORT1",
          linkTo: "VID-LONG",
          angle: null,
          body: null,
          relays: [],
          status: "À faire",
          publishedUrl: null,
        },
      ],
    });
    expect(parsed.campaign).toMatchObject({
      name: "Promotion vidéo LDDLT",
      startDate: "2026-10-05",
      brief: "Un brief\nsur deux lignes.",
      mainContentCode: "VID-LONG",
    });
    expect(parsed.contents.map((c) => [c.code, c.type, c.durationSec])).toEqual([
      ["VID-LONG", "LONG_VIDEO", 720],
      ["CAP1", "CAPSULE", 95],
      ["SHORT1", "SHORT", null],
    ]);
    expect(parsed.rows).toHaveLength(2);
    expect(parsed.rows[0]).toMatchObject({
      week: 1,
      dayOffset: 0,
      time: "09:00",
      account: "IT for Business",
      format: "VIDEO_POST",
      contentCode: "CAP1",
      angle: "Accroche",
      body: "Texte imposé",
      relayNames: ["Anne Laure"],
    });
    expect(parsed.rows[1]).toMatchObject({
      dayOffset: 3,
      time: "18:30",
      format: "SHORT",
      linkTo: "VID-LONG",
    });

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
          {
            id: "al",
            firstName: "Anne Laure",
            lastName: null,
            email: "anne-laure@example.invalid",
          },
        ],
        campaign: null,
        canCreateContributors: false,
      },
      {},
      new Date("2026-09-24T10:00:00Z"),
    );
    expect(preview.counts).toMatchObject({ posts: 2, errors: 0, missions: 1, withText: 1 });
  });
});
