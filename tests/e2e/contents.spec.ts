import { BRAND, expect, expectAccessible, test } from "./fixtures";

test("ajouter une capsule et la supprimer avec annulation", async ({ asAdmin: page }) => {
  await page.goto(`${BRAND}/campagnes`);
  await page
    .getByRole("link", { name: /^Ouvrir : Promotion vidéo LDDLT/ })
    .first()
    .click();
  await page.getByRole("link", { name: "Contenus" }).click();
  await expect(page.getByText("VID-LONG", { exact: true })).toBeVisible();
  await expectAccessible(page, "contenus");

  await page.getByRole("button", { name: "Ajouter un contenu" }).click();
  await expect(page.getByLabel("Code")).toHaveValue("CAP7");
  await page.getByLabel("Titre").fill("Capsule bonus");
  await page.getByLabel("Lien du média").fill("https://example.org/capsule-bonus");
  await page.getByRole("button", { name: "Ajouter le contenu" }).click();
  await expect(page.getByText("Capsule bonus")).toBeVisible();

  await page.getByRole("button", { name: "Actions pour CAP7" }).click();
  await page.getByRole("menuitem", { name: "Supprimer" }).click();
  await expect(page.getByText("Capsule bonus")).toHaveCount(0);
  await page.getByRole("button", { name: "Annuler" }).click();
  await expect(page.getByText("Capsule bonus")).toBeVisible();
});
