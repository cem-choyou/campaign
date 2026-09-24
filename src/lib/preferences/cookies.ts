// Interface preferences stored in strictly necessary first-party cookies (§5): no consent banner.

export const THEME_COOKIE = "theme";
export const SIDEBAR_COOKIE = "sidebar";
export const CALENDAR_VIEW_COOKIE = "calendar-view";
export const PLANNING_MODE_COOKIE = "planning-mode";
export const CAMPAIGNS_VIEW_COOKIE = "campaigns-view";

export const THEMES = ["light", "dark", "system"] as const;
export type Theme = (typeof THEMES)[number];

export function parseTheme(value: string | undefined): Theme {
  return THEMES.includes(value as Theme) ? (value as Theme) : "system";
}

const ONE_YEAR = 60 * 60 * 24 * 365;

/** Client-side write of a preference cookie (not HttpOnly: it only holds UI preferences). */
export function writePreferenceCookie(name: string, value: string): void {
  const secure = window.location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${name}=${encodeURIComponent(value)}; Path=/; Max-Age=${ONE_YEAR}; SameSite=Lax${secure}`;
}
