import { describe, expect, it } from "vitest";
import {
  DARK_BACKGROUND,
  DARK_TEXT,
  FALLBACK_ACCENT,
  LIGHT_BACKGROUND,
  LIGHT_TEXT,
  accessibleAccent,
  brandAccentVars,
  contrastRatio,
  hexToRgb,
  luminance,
  normalizeHex,
  readableOn,
} from "@/lib/color";

describe("hex parsing", () => {
  it("parses 3 and 6 digit colors, with or without #", () => {
    expect(hexToRgb("#1F3A5F")).toEqual({ r: 31, g: 58, b: 95 });
    expect(hexToRgb("fff")).toEqual({ r: 255, g: 255, b: 255 });
    expect(normalizeHex(" #abc ")).toBe("#AABBCC");
  });
  it("rejects invalid values", () => {
    expect(hexToRgb("blue")).toBeNull();
    expect(normalizeHex("#12345")).toBeNull();
  });
});

describe("contrast", () => {
  it("matches WCAG reference values", () => {
    expect(luminance("#000000")).toBe(0);
    expect(luminance("#FFFFFF")).toBeCloseTo(1);
    expect(contrastRatio("#000000", "#FFFFFF")).toBeCloseTo(21);
  });

  it("picks white text on dark colors and dark text on light colors", () => {
    expect(readableOn("#1F3A5F")).toBe(LIGHT_TEXT);
    expect(readableOn("#FACC15")).toBe(DARK_TEXT);
    expect(readableOn("#FFFFFF")).toBe(DARK_TEXT);
  });
});

describe("accessibleAccent", () => {
  it("keeps a color that already contrasts", () => {
    expect(accessibleAccent("#1F3A5F", LIGHT_BACKGROUND)).toBe("#1F3A5F");
  });

  it("lightens a dark brand color on the dark theme", () => {
    const accent = accessibleAccent("#1F3A5F", DARK_BACKGROUND);
    expect(accent).not.toBe("#1F3A5F");
    expect(contrastRatio(accent, DARK_BACKGROUND)).toBeGreaterThanOrEqual(3);
  });

  it("darkens a pale color on the light theme", () => {
    const accent = accessibleAccent("#FDE68A", LIGHT_BACKGROUND);
    expect(contrastRatio(accent, LIGHT_BACKGROUND)).toBeGreaterThanOrEqual(3);
  });

  it("falls back to blue on invalid input", () => {
    expect(accessibleAccent("nope", LIGHT_BACKGROUND)).toBe(FALLBACK_ACCENT);
  });

  it("exposes CSS variables with readable foregrounds", () => {
    const vars = brandAccentVars("#1F3A5F");
    expect(vars["--brand-light"]).toBe("#1F3A5F");
    expect(vars["--brand-light-foreground"]).toBe(LIGHT_TEXT);
    expect(contrastRatio(vars["--brand-dark"]!, DARK_BACKGROUND)).toBeGreaterThanOrEqual(3);
  });
});
