import { describe, expect, it } from "vitest";
import {
  normalizeKey,
  parseContentType,
  parseDateCell,
  parseDay,
  parseFormat,
  parseTime,
  parseWeek,
  splitNames,
} from "@/lib/import/normalize";

describe("import normalization", () => {
  it("ignores case, accents and spaces", () => {
    expect(normalizeKey("ITforBusiness")).toBe(normalizeKey("IT for Business"));
    expect(normalizeKey("Anne-Laure")).toBe(normalizeKey("anne laure"));
    expect(normalizeKey("Vidéo longue")).toBe("videolongue");
  });

  it("reads days", () => {
    expect(parseDay("Lundi")).toBe(0);
    expect(parseDay("MERCREDI")).toBe(2);
    expect(parseDay("jeu.")).toBe(3);
    expect(parseDay("Sunday")).toBe(6);
    expect(parseDay("Lundii")).toBeNull();
    expect(parseDay("")).toBeNull();
  });

  it("reads weeks", () => {
    expect(parseWeek(1)).toBe(1);
    expect(parseWeek("Semaine 3")).toBe(3);
    expect(parseWeek("S2")).toBe(2);
    expect(parseWeek(0)).toBeNull();
    expect(parseWeek(1.5)).toBeNull();
    expect(parseWeek("x")).toBeNull();
  });

  it("reads times from Excel dates, fractions and text", () => {
    expect(parseTime(new Date(Date.UTC(1899, 11, 30, 9, 0)))).toBe("09:00");
    expect(parseTime(0.5)).toBe("12:00");
    expect(parseTime("9h30")).toBe("09:30");
    expect(parseTime("18:05")).toBe("18:05");
    expect(parseTime("9h")).toBe("09:00");
    expect(parseTime("25:00")).toBeNull();
    expect(parseTime("midi")).toBeNull();
  });

  it("reads typed dates", () => {
    expect(parseDateCell(new Date(Date.UTC(2026, 9, 5)))).toBe("2026-10-05");
    expect(parseDateCell("05/10/2026")).toBe("2026-10-05");
    expect(parseDateCell("2026-10-05")).toBe("2026-10-05");
    expect(parseDateCell("demain")).toBeNull();
  });

  it("maps the template's labels", () => {
    expect(parseFormat("Post vidéo")).toBe("VIDEO_POST");
    expect(parseFormat("short")).toBe("SHORT");
    expect(parseFormat("Document PDF")).toBe("DOCUMENT");
    expect(parseFormat("Story")).toBeNull();
    expect(parseContentType("Capsule")).toBe("CAPSULE");
    expect(parseContentType("Vidéo longue")).toBe("LONG_VIDEO");
  });

  it("splits relay names", () => {
    expect(splitNames("Anne Laure, Paul ; Marie et Jean")).toEqual([
      "Anne Laure",
      "Paul",
      "Marie",
      "Jean",
    ]);
    expect(splitNames("")).toEqual([]);
  });
});
