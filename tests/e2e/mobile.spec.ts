import { BRAND, expect, signInAs, test } from "./fixtures";

const noHorizontalScroll = () => document.documentElement.scrollWidth <= window.innerWidth;

test.describe("mobile (390 px)", () => {
  test.beforeEach(async ({ page }) => signInAs(page, "admin"));

  for (const path of ["/aujourdhui", "/campagnes", "/calendrier", "/reglages/acces"]) {
    test(`pas de défilement horizontal sur ${path}`, async ({ page }) => {
      await page.goto(`${BRAND}${path}`);
      await page.waitForLoadState("networkidle");
      expect(await page.evaluate(noHorizontalScroll)).toBe(true);
    });
  }

  test("menu et éditeur de post utilisables sur téléphone", async ({ page }) => {
    await page.goto(`${BRAND}/aujourdhui`);
    await page.getByRole("button", { name: "Ouvrir le menu" }).click();
    await page.getByRole("link", { name: "Campagnes" }).click();
    await expect(page).toHaveURL(new RegExp(`${BRAND}/campagnes$`));

    await page.context().addCookies([{ name: "planning-mode", value: "list", url: page.url() }]);
    await page
      .getByRole("link", { name: /^Ouvrir : Promotion vidéo LDDLT/ })
      .first()
      .click();
    await page.locator("tbody tr").first().getByRole("button").first().click();
    await expect(page.locator("#post-body")).toBeVisible();
    expect(await page.evaluate(noHorizontalScroll)).toBe(true);
  });
});
