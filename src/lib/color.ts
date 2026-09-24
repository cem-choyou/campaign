// Color helpers: contrast computations (WCAG 2.1) used for brand accents and calendar events.
// FullCalendar paints event text white by default: always pick the text color with readableOn().

export type Rgb = { r: number; g: number; b: number };

export const FALLBACK_ACCENT = "#2563EB";
export const DARK_TEXT = "#0A0A0A";
export const LIGHT_TEXT = "#FFFFFF";
/** Page backgrounds, kept in sync with globals.css (light / dark). */
export const LIGHT_BACKGROUND = "#FFFFFF";
export const DARK_BACKGROUND = "#111113";

const HEX = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i;

export function isHexColor(value: string): boolean {
  return HEX.test(value.trim());
}

export function normalizeHex(value: string): string | null {
  const match = HEX.exec(value.trim());
  if (!match?.[1]) return null;
  const raw = match[1];
  const full = raw.length === 3 ? [...raw].map((c) => c + c).join("") : raw;
  return `#${full.toUpperCase()}`;
}

export function hexToRgb(hex: string): Rgb | null {
  const normalized = normalizeHex(hex);
  if (!normalized) return null;
  const n = Number.parseInt(normalized.slice(1), 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

export function rgbToHex({ r, g, b }: Rgb): string {
  const part = (v: number) =>
    Math.round(Math.min(255, Math.max(0, v)))
      .toString(16)
      .padStart(2, "0");
  return `#${part(r)}${part(g)}${part(b)}`.toUpperCase();
}

/** Relative luminance (WCAG 2.1). */
export function luminance(hex: string): number {
  const rgb = hexToRgb(hex);
  if (!rgb) return 0;
  const channel = (v: number) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(rgb.r) + 0.7152 * channel(rgb.g) + 0.0722 * channel(rgb.b);
}

export function contrastRatio(a: string, b: string): number {
  const la = luminance(a);
  const lb = luminance(b);
  const [hi, lo] = la > lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

/** Text color (near-black or white) that reads best on the given background. */
export function readableOn(background: string): string {
  return contrastRatio(background, DARK_TEXT) >= contrastRatio(background, LIGHT_TEXT)
    ? DARK_TEXT
    : LIGHT_TEXT;
}

function mix(hex: string, target: string, amount: number): string {
  const a = hexToRgb(hex);
  const b = hexToRgb(target);
  if (!a || !b) return hex;
  return rgbToHex({
    r: a.r + (b.r - a.r) * amount,
    g: a.g + (b.g - a.g) * amount,
    b: a.b + (b.b - a.b) * amount,
  });
}

/**
 * Brand accent adjusted to stay readable against a page background (UI accents need 3:1,
 * WCAG 1.4.11). The color is lightened on dark backgrounds and darkened on light ones; if no
 * variant qualifies, the fallback blue is used.
 */
export function accessibleAccent(color: string, background: string, minRatio = 3): string {
  const base = normalizeHex(color);
  if (!base) return FALLBACK_ACCENT;
  if (contrastRatio(base, background) >= minRatio) return base;
  const towards = luminance(background) < 0.5 ? "#FFFFFF" : "#000000";
  for (let step = 1; step <= 10; step++) {
    const candidate = mix(base, towards, step * 0.08);
    if (contrastRatio(candidate, background) >= minRatio) return candidate;
  }
  return FALLBACK_ACCENT;
}

/** CSS custom properties for the active brand, for both themes. */
export function brandAccentVars(color: string): Record<string, string> {
  const light = accessibleAccent(color, LIGHT_BACKGROUND);
  const dark = accessibleAccent(color, DARK_BACKGROUND);
  return {
    "--brand-light": light,
    "--brand-light-foreground": readableOn(light),
    "--brand-dark": dark,
    "--brand-dark-foreground": readableOn(dark),
  };
}

/** `:root` rule applying the brand accent globally (portals included). Values are normalized hex. */
export function brandAccentCss(color: string): string {
  const declarations = Object.entries(brandAccentVars(color))
    .map(([name, value]) => `${name}:${value}`)
    .join(";");
  return `:root{${declarations}}`;
}
