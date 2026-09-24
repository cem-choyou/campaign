import { readFileSync } from "node:fs";
import AxeBuilder from "@axe-core/playwright";
import { type Page, test as base, expect } from "@playwright/test";
import { E2E, type Role, SESSIONS_FILE } from "./config";

/** Signs the browser context in as a role by setting the Auth.js session cookie. */
export async function signInAs(page: Page, role: Role) {
  const sessions = JSON.parse(readFileSync(SESSIONS_FILE, "utf8")) as Record<Role, string>;
  const url = new URL(E2E.baseURL);
  await page.context().addCookies([
    {
      name: "authjs.session-token",
      value: sessions[role],
      domain: url.hostname,
      path: "/",
      httpOnly: true,
      sameSite: "Lax",
    },
  ]);
}

/** WCAG 2.1 AA check; serious and critical violations fail the test. */
export async function expectAccessible(page: Page, context: string) {
  // Colours are checked at rest: a button fading in (disabled → enabled) is not a violation.
  await page.addStyleTag({
    content: "*, *::before, *::after { transition: none !important; animation: none !important; }",
  });
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .exclude("nextjs-portal")
    .analyze();
  const blocking = results.violations.filter(
    (v) => v.impact === "serious" || v.impact === "critical",
  );
  expect(
    blocking.map(
      (v) => `${v.id}: ${v.help} (${v.nodes.map((n) => n.target.join(" ")).join(", ")})`,
    ),
    `Accessibilité — ${context}`,
  ).toEqual([]);
}

export const test = base.extend<{ asAdmin: Page }>({
  asAdmin: async ({ page }, apply) => {
    await signInAs(page, "admin");
    await apply(page);
  },
});

export { expect };

export const BRAND = "/it-for-business";
export const DEMO = "Promotion vidéo LDDLT";
