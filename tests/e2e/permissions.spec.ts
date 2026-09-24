import { BRAND, expect, signInAs, test } from "./fixtures";

test.describe("droits", () => {
  test("un éditeur ne voit pas les réglages de la marque", async ({ page }) => {
    await signInAs(page, "editor");
    await page.goto(`${BRAND}/aujourdhui`);
    const nav = page.getByRole("navigation", { name: "Navigation principale" });
    await expect(nav.getByRole("link", { name: "Campagnes" })).toBeVisible();
    await expect(nav.getByRole("link", { name: "Réglages de la marque" })).toHaveCount(0);
    const res = await page.goto(`${BRAND}/reglages/acces`);
    expect(res?.status()).toBe(404);
  });

  test("un client ne voit pas une autre marque et ne peut pas planifier", async ({ page }) => {
    await signInAs(page, "client");
    const other = await page.goto("/autre-marque/campagnes");
    expect(other?.status()).toBe(404);
    await page.goto(`${BRAND}/campagnes`);
    await expect(page.getByRole("link", { name: "Créer une campagne" })).toHaveCount(0);
    await page
      .getByRole("link", { name: /Promotion vidéo LDDLT/ })
      .first()
      .click();
    await expect(page.getByRole("link", { name: "Ajouter un post" })).toHaveCount(0);
  });

  test("un super admin voit toutes les marques", async ({ page }) => {
    await signInAs(page, "admin");
    await page.goto(`${BRAND}/aujourdhui`);
    await page.getByRole("button", { name: /Changer de marque/ }).click();
    await expect(page.getByRole("option", { name: "Autre marque" })).toBeVisible();
  });
});
