import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { type BrandData, resolveImport } from "@/lib/import/resolve";
import type { ParsedWorkbook } from "@/lib/import/types";
import { isTemplate, parseTemplate, readWorkbook } from "@/server/import/parse";

const TEMPLATE = "docs/templates/modele-campagne.xlsx";

async function loadTemplate() {
  const buffer = readFileSync(TEMPLATE);
  const workbook = await readWorkbook(
    buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) as ArrayBuffer,
  );
  return { workbook, parsed: parseTemplate(workbook) };
}

const brand: BrandData = {
  name: "IT for Business",
  timezone: "Europe/Paris",
  accounts: [
    { id: "page", name: "IT for Business", platform: "LINKEDIN" },
    { id: "yt", name: "IT for Business YouTube", platform: "YOUTUBE" },
  ],
  contributors: [
    { id: "al", firstName: "Anne Laure", lastName: null, email: "anne-laure@example.invalid" },
  ],
  campaign: null,
  canCreateContributors: true,
};

// Before the LDDLT start (5 Oct 2026), so every row is in the future.
const NOW = new Date("2026-09-24T10:00:00Z");

describe("template parser (docs/templates/modele-campagne.xlsx)", () => {
  it("recognises the template and reads every sheet", async () => {
    const { workbook, parsed } = await loadTemplate();
    expect(isTemplate(workbook)).toBe(true);
    expect(parsed.kind).toBe("template");
    expect(parsed.campaign).toMatchObject({
      brand: "IT for Business",
      name: "Promotion vidéo LDDLT",
      startDate: "2026-10-05",
      mainContentCode: "VID-LONG",
    });
    expect(parsed.contents).toHaveLength(13);
    expect(parsed.contents[1]).toMatchObject({ code: "CAP1", type: "CAPSULE", title: "Capsule 1" });
    expect(parsed.rows).toHaveLength(18);
    expect(parsed.rows[0]).toMatchObject({
      row: 2,
      week: 1,
      dayOffset: 0,
      time: "09:00",
      account: "ITforBusiness",
      format: "VIDEO_POST",
      contentCode: "CAP1",
      // The Date column is a formula: ignored, recomputed from week + day.
      date: null,
    });
    expect(parsed.rows[1]).toMatchObject({
      account: "Anne Laure",
      published: true,
      publishedUrl: "https://lnkd.in/p/e3Aw4K5d",
    });
    expect(parsed.rows[2]).toMatchObject({ format: "SHORT", linkTo: "VID-LONG" });
    expect(parsed.contributors).toEqual([expect.objectContaining({ firstName: "Anne Laure" })]);
  });

  it("resolves the LDDLT plan into 18 posts without errors", async () => {
    const { parsed } = await loadTemplate();
    const preview = resolveImport(parsed, brand, {}, NOW);
    expect(preview.counts.errors).toBe(0);
    expect(preview.counts.posts).toBe(18);
    expect(preview.counts.published).toBe(1);

    const [first, second, third] = preview.posts;
    // « ITforBusiness » matches the « IT for Business » page exactly (tolerant key).
    expect(first!.publisher).toMatchObject({ kind: "account", id: "page" });
    expect(first!.scheduledAt).toBe("2026-10-05T07:00:00.000Z"); // 09:00 Paris (summer time)
    expect(second!.publisher).toMatchObject({ kind: "contributor", id: "al" });
    expect(second!.date).toBe("2026-10-07");
    expect(third).toMatchObject({ format: "SHORT", linkToCode: "VID-LONG", contentCode: "SHORT1" });
    expect(third!.publisher).toMatchObject({ kind: "account", id: "yt" });

    // Week 4 is after the switch to winter time (25 Oct 2026): 09:00 Paris = 08:00 UTC.
    const week4 = preview.posts.find((p) => p.date === "2026-10-26")!;
    expect(week4.scheduledAt).toBe("2026-10-26T08:00:00.000Z");
    // One POST mission per post by Anne Laure (6 rows).
    expect(preview.counts.missions).toBe(6);
  });
});

function workbook(rows: Partial<ParsedWorkbook["rows"][number]>[]): ParsedWorkbook {
  return {
    kind: "template",
    campaign: {
      brand: "IT for Business",
      name: "Test",
      startDate: "2026-10-05",
      objective: "",
      audience: "",
      brief: "",
      mainContentCode: "",
    },
    contents: [
      {
        row: 2,
        code: "CAP1",
        type: "CAPSULE",
        typeLabel: "Capsule",
        title: "Capsule 1",
        mediaUrl: "",
        durationSec: null,
        summary: "",
        youtubeUrl: "",
      },
    ],
    contributors: [
      {
        row: 2,
        firstName: "Paul",
        lastName: "Martin",
        email: "paul@example.org",
        jobTitle: "",
        linkedinUrl: "",
        toneNote: "",
      },
      {
        row: 3,
        firstName: "Sans",
        lastName: "Mail",
        email: "",
        jobTitle: "",
        linkedinUrl: "",
        toneNote: "",
      },
    ],
    rows: rows.map((r, i) => ({
      row: i + 2,
      week: 1,
      weekLabel: "1",
      dayOffset: 0,
      dayLabel: "Lundi",
      date: null,
      time: "09:00",
      timeLabel: "09:00",
      account: "IT for Business",
      format: "VIDEO_POST",
      formatLabel: "Post vidéo",
      contentCode: "CAP1",
      linkTo: "",
      angle: "",
      body: "",
      relayNames: [],
      statusPublished: false,
      published: false,
      publishedUrl: "",
      ...r,
    })),
    fileIssues: [],
  };
}

const messages = (preview: ReturnType<typeof resolveImport>, row = 0) =>
  preview.posts[row]!.issues.map((i) => `${i.level}: ${i.message}`);

describe("import resolution", () => {
  it("reports clear, fixable errors", () => {
    const preview = resolveImport(
      workbook([
        { dayOffset: null, dayLabel: "Lundii" },
        { contentCode: "CAP9" },
        { account: "Shorts" },
        { format: "SHORT", formatLabel: "Short" },
        { time: null, timeLabel: "" },
      ]),
      brand,
      {},
      NOW,
    );
    expect(messages(preview, 0)).toContain("error: Jour « Lundii » inconnu.");
    expect(messages(preview, 1)).toContain("error: Contenu CAP9 absent de l'onglet Contenus.");
    expect(messages(preview, 2)[0]).toMatch(/^error: Compte « Shorts » inconnu/);
    expect(messages(preview, 3)[0]).toMatch(/format « Short » n'existe pas sur LinkedIn/);
    expect(messages(preview, 4)).toEqual(["warning: Heure manquante : 09:00 par défaut."]);
    expect(preview.counts.errors).toBe(4);
  });

  it("applies the corrections typed in the preview", () => {
    const parsed = workbook([{ account: "Shorts", format: null, formatLabel: "" }]);
    const fixed = resolveImport(parsed, brand, { 2: { publisher: "account:yt" } }, NOW);
    expect(fixed.posts[0]!.issues).toEqual([]);
    // Format inferred from the YouTube account (a capsule on YouTube → long video).
    expect(fixed.posts[0]!.format).toBe("LONG_VIDEO");
    const skipped = resolveImport(parsed, brand, { 2: { skip: true } }, NOW);
    expect(skipped.counts).toMatchObject({ posts: 0, skipped: 1, errors: 0 });
  });

  it("refuses past dates, except published history", () => {
    const late = new Date("2026-10-06T10:00:00Z");
    const preview = resolveImport(
      workbook([{}, { statusPublished: true, published: true, publishedUrl: "https://lnkd.in/x" }]),
      brand,
      {},
      late,
    );
    expect(messages(preview, 0)).toContain(
      "error: Cette date est passée : choisissez une date à venir.",
    );
    expect(preview.posts[1]!.issues).toEqual([]);
    expect(preview.posts[1]!.published).toBe(true);
  });

  it("creates contributors from the Relais sheet only for admins, and only with an e-mail", () => {
    const parsed = workbook([{ account: "Paul Martin", relayNames: ["Anne Laure", "Inconnu"] }]);
    const admin = resolveImport(parsed, brand, {}, NOW);
    expect(admin.newContributors).toEqual([
      expect.objectContaining({ key: "paul@example.org", firstName: "Paul" }),
    ]);
    expect(admin.posts[0]!.publisher).toMatchObject({
      kind: "contributor",
      id: null,
      key: "paul@example.org",
    });
    expect(admin.posts[0]!.relays).toEqual([
      { name: "Anne Laure", contributorId: "al", key: undefined },
    ]);
    expect(messages(admin)).toEqual([
      expect.stringMatching(/^warning: Relais « Inconnu » inconnu.*Mission ignorée\.$/),
    ]);

    const editor = resolveImport(parsed, { ...brand, canCreateContributors: false }, {}, NOW);
    expect(messages(editor)[0]).toMatch(/demandez à un administrateur/);

    const noEmail = resolveImport(workbook([{ account: "Sans Mail" }]), brand, {}, NOW);
    expect(messages(noEmail)[0]).toMatch(/indiquez son e-mail dans l'onglet Relais/);
  });

  it("uses the campaign's start date and contents when importing into an existing campaign", () => {
    const parsed = workbook([{ contentCode: "VID-LONG" }]);
    parsed.campaign.startDate = null;
    parsed.contents = [];
    const preview = resolveImport(
      parsed,
      {
        ...brand,
        campaign: {
          name: "Existante",
          startDate: "2026-10-12",
          contents: [{ code: "VID-LONG", type: "LONG_VIDEO", title: "Vidéo longue" }],
        },
      },
      {},
      NOW,
    );
    expect(preview.counts.errors).toBe(0);
    expect(preview.posts[0]!.date).toBe("2026-10-12");
    expect(preview.posts[0]!.contentTitle).toBe("Vidéo longue");
  });
});
