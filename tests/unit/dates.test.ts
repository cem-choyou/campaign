import { describe, expect, it } from "vitest";
import {
  formatDateOnly,
  formatDay,
  formatDayLong,
  formatRelative,
  formatTime,
  fromWeekDay,
  localToUtc,
  mondayOf,
  parseDateOnly,
  shiftLocalDays,
  toLocalParts,
  withLocalDate,
  withLocalTime,
} from "@/lib/dates";

describe("local ↔ UTC in Europe/Paris", () => {
  it("converts summer time (UTC+2)", () => {
    expect(localToUtc("2026-10-05", "09:00").toISOString()).toBe("2026-10-05T07:00:00.000Z");
  });

  it("converts winter time (UTC+1)", () => {
    expect(localToUtc("2026-11-02", "09:00").toISOString()).toBe("2026-11-02T08:00:00.000Z");
  });

  it("round-trips to local parts", () => {
    expect(toLocalParts(new Date("2026-10-05T07:00:00Z"))).toEqual({
      date: "2026-10-05",
      time: "09:00",
    });
    expect(toLocalParts(new Date("2026-10-05T22:30:00Z"))).toEqual({
      date: "2026-10-06",
      time: "00:30",
    });
  });

  it("rejects invalid input", () => {
    expect(() => localToUtc("2026-13-01", "09:00")).toThrow();
    expect(() => localToUtc("2026-10-05", "9h")).toThrow();
    expect(() => parseDateOnly("05/10/2026")).toThrow();
  });
});

describe("Excel week/day rule (§6.4)", () => {
  const start = "2026-10-05"; // Monday of week 1 (LDDLT)

  it("computes Monday, Wednesday and Thursday of week 1", () => {
    expect(fromWeekDay(start, 1, 0).toISOString()).toBe("2026-10-05T07:00:00.000Z");
    expect(fromWeekDay(start, 1, 2).toISOString()).toBe("2026-10-07T07:00:00.000Z");
    expect(fromWeekDay(start, 1, 3, "18:30").toISOString()).toBe("2026-10-08T16:30:00.000Z");
  });

  it("keeps 09:00 local across the October DST change (25/10/2026)", () => {
    // Week 3 Friday = 23/10 (UTC+2), week 4 Monday = 26/10 (UTC+1).
    expect(fromWeekDay(start, 3, 4).toISOString()).toBe("2026-10-23T07:00:00.000Z");
    expect(fromWeekDay(start, 4, 0).toISOString()).toBe("2026-10-26T08:00:00.000Z");
    expect(fromWeekDay(start, 3, 6).toISOString()).toBe("2026-10-25T08:00:00.000Z"); // DST day itself
  });

  it("keeps 09:00 local across the March DST change (28/03/2027)", () => {
    const march = "2027-03-22";
    expect(fromWeekDay(march, 1, 5).toISOString()).toBe("2027-03-27T08:00:00.000Z"); // Sat, UTC+1
    expect(fromWeekDay(march, 1, 6).toISOString()).toBe("2027-03-28T07:00:00.000Z"); // Sun, UTC+2
  });

  it("accepts a Date start (Prisma DATE column)", () => {
    expect(fromWeekDay(parseDateOnly(start), 2, 0).toISOString()).toBe("2026-10-12T07:00:00.000Z");
  });

  it("rejects out-of-range weeks and days", () => {
    expect(() => fromWeekDay(start, 0, 0)).toThrow();
    expect(() => fromWeekDay(start, 1, 7)).toThrow();
  });
});

describe("moving posts", () => {
  it("shifts by local days keeping the local time across DST", () => {
    const friday = localToUtc("2026-10-23", "09:00");
    expect(shiftLocalDays(friday, 3).toISOString()).toBe("2026-10-26T08:00:00.000Z");
    expect(shiftLocalDays(friday, -3).toISOString()).toBe("2026-10-20T07:00:00.000Z");
  });

  it("changes the local day or the local time only", () => {
    const post = localToUtc("2026-10-05", "09:00");
    expect(withLocalDate(post, "2026-10-27").toISOString()).toBe("2026-10-27T08:00:00.000Z");
    expect(withLocalTime(post, "18:15").toISOString()).toBe("2026-10-05T16:15:00.000Z");
  });

  it("finds the Monday of a week", () => {
    expect(mondayOf("2026-10-08")).toBe("2026-10-05");
    expect(mondayOf("2026-10-05")).toBe("2026-10-05");
    expect(mondayOf("2026-10-11")).toBe("2026-10-05");
  });
});

describe("French display", () => {
  const post = localToUtc("2026-10-05", "09:00");

  it("formats days and times", () => {
    expect(formatDay(post)).toBe("lun. 5 oct.");
    expect(formatDayLong(localToUtc("2026-10-07", "09:00"))).toBe("mercredi 7 octobre");
    expect(formatTime(post)).toBe("09:00");
    expect(formatDateOnly(parseDateOnly("2026-10-05"))).toBe("2026-10-05");
  });

  it("formats relative times", () => {
    const now = localToUtc("2026-10-05", "07:00");
    expect(formatRelative(localToUtc("2026-10-05", "09:00"), now)).toBe("dans 2 h");
    expect(formatRelative(localToUtc("2026-10-05", "06:55"), now)).toBe("il y a 5 min");
    expect(formatRelative(localToUtc("2026-10-05", "18:00"), now)).toBe("aujourd'hui à 18:00");
    expect(formatRelative(localToUtc("2026-10-06", "09:00"), now)).toBe("demain à 09:00");
    expect(formatRelative(localToUtc("2026-10-04", "09:00"), now)).toBe("hier à 09:00");
    expect(formatRelative(localToUtc("2026-10-12", "09:00"), now)).toBe("lun. 12 oct.");
  });
});
