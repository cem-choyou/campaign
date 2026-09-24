import type { Page } from "@playwright/test";
import { E2E } from "./config";
import { BRAND, expect, signInAs, test } from "./fixtures";

// Captures of every lot 1 screen: 1440 px and 390 px, light and dark (§0, §8.12).
// Output: tests/screenshots/<screen>-<desktop|mobile>-<light|dark>.png

const VIEWPORTS = [
  { name: "desktop", width: 1440, height: 900 },
  { name: "mobile", width: 390, height: 844 },
] as const;
const THEMES = ["light", "dark"] as const;

type Screen = {
  name: string;
  path: string | ((page: Page) => Promise<string>);
  anonymous?: boolean;
  cookies?: Record<string, string>;
};

async function demoCampaignPath(page: Page) {
  await page.goto(`${BRAND}/campagnes`);
  const href = await page
    .getByRole("link", { name: /^Ouvrir : Promotion vidéo LDDLT/ })
    .first()
    .getAttribute("href");
  return href!;
}

async function firstPostPath(page: Page) {
  const base = await demoCampaignPath(page);
  await page.context().addCookies([{ name: "planning-mode", value: "list", url: E2E.baseURL }]);
  await page.goto(base);
  await page.locator("tbody tr").first().getByRole("button").first().click();
  await page.waitForURL(/\?post=/);
  return new URL(page.url()).pathname + new URL(page.url()).search;
}

const SCREENS: Screen[] = [
  { name: "01-connexion", path: "/connexion", anonymous: true },
  { name: "02-connexion-envoye", path: "/connexion/envoye", anonymous: true },
  { name: "03-aujourdhui", path: `${BRAND}/aujourdhui` },
  { name: "04-campagnes", path: `${BRAND}/campagnes` },
  { name: "05-assistant", path: `${BRAND}/campagnes/nouvelle` },
  {
    name: "06-planning-calendrier",
    path: demoCampaignPath,
    cookies: { "planning-mode": "calendar", "calendar-view": "dayGridMonth" },
  },
  { name: "07-planning-liste", path: demoCampaignPath, cookies: { "planning-mode": "list" } },
  { name: "08-editeur-post", path: firstPostPath },
  { name: "09-contenus", path: async (p) => `${await demoCampaignPath(p)}/contenus` },
  { name: "10-activite", path: async (p) => `${await demoCampaignPath(p)}/activite` },
  { name: "11-reglages-campagne", path: async (p) => `${await demoCampaignPath(p)}/reglages` },
  {
    name: "12-calendrier-marque",
    path: `${BRAND}/calendrier`,
    cookies: { "planning-mode": "calendar", "calendar-view": "timeGridWeek" },
  },
  { name: "13-reglages-marque", path: `${BRAND}/reglages/marque` },
  { name: "14-reglages-comptes", path: `${BRAND}/reglages/comptes` },
  { name: "15-reglages-acces", path: `${BRAND}/reglages/acces` },
  { name: "16-reglages-relais", path: `${BRAND}/reglages/relais` },
  { name: "17-invitation-invalide", path: "/invitation/lien-expire", anonymous: true },
  { name: "18-page-introuvable", path: `${BRAND}/campagnes/inexistante` },
  { name: "19-confidentialite", path: "/confidentialite", anonymous: true },
  { name: "20-mentions-legales", path: "/mentions-legales", anonymous: true },
];

for (const screen of SCREENS) {
  for (const vp of VIEWPORTS) {
    for (const theme of THEMES) {
      test(`${screen.name} ${vp.name} ${theme}`, async ({ page }) => {
        await page.setViewportSize({ width: vp.width, height: vp.height });
        await page.context().addCookies(
          Object.entries({ theme, ...screen.cookies }).map(([name, value]) => ({
            name,
            value,
            url: E2E.baseURL,
          })),
        );
        if (!screen.anonymous) await signInAs(page, "admin");
        const path = typeof screen.path === "string" ? screen.path : await screen.path(page);
        await page.goto(path);
        await page.waitForLoadState("networkidle");
        await page.waitForTimeout(300);
        const overflow = await page.evaluate(
          () => document.documentElement.scrollWidth - window.innerWidth,
        );
        expect(overflow, "défilement horizontal").toBeLessThanOrEqual(0);
        await page.screenshot({
          path: `tests/screenshots/${screen.name}-${vp.name}-${theme}.png`,
          fullPage: vp.name === "desktop",
        });
      });
    }
  }
}
