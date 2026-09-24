import { BRAND, DEMO, expect, expectAccessible, test } from "./fixtures";

test.describe("assistant et liste des campagnes", () => {
  test("créer une campagne, la quitter puis la reprendre à la bonne étape", async ({
    asAdmin: page,
  }) => {
    const name = `Campagne e2e ${Date.now()}`;
    await page.goto(`${BRAND}/campagnes/nouvelle`);
    await expectAccessible(page, "assistant étape 1");

    await page.getByLabel("Nom de la campagne").fill(name);
    await page.getByLabel("Objectif").fill("Tester le parcours complet.");
    // The draft is created at the first input and the URL follows it.
    await expect(page).toHaveURL(/\/campagnes\/[a-z0-9]+\/assistant$/, { timeout: 15_000 });

    await page.getByRole("button", { name: "Continuer" }).click();
    await page.getByLabel("Cible").fill("Équipes IT");
    await expect(page.getByText("Enregistré")).toBeVisible({ timeout: 10_000 });
    await page.getByRole("button", { name: "Enregistrer et quitter" }).click();
    await expect(page).toHaveURL(new RegExp(`${BRAND}/campagnes$`));

    await page.getByRole("link", { name: `Reprendre : ${name}` }).click();
    await expect(page.getByRole("heading", { name: "Le brief" })).toBeVisible();
    await expect(page.getByLabel("Cible")).toHaveValue("Équipes IT");

    await page.keyboard.press("Control+Enter");
    await page.keyboard.press("Control+Enter");
    await expect(page.getByRole("heading", { name: "Récapitulatif" })).toBeVisible();
    await page.getByRole("button", { name: "Ouvrir la campagne" }).click();
    await expect(
      page.getByRole("tab", { name: "Planning" }).or(page.getByRole("link", { name: "Planning" })),
    ).toBeVisible();
    await expect(page.getByRole("heading", { level: 1 })).toContainText(name);
  });

  test("renommer en place, archiver avec annulation, dupliquer", async ({ asAdmin: page }) => {
    await page.goto(`${BRAND}/campagnes`);
    await expectAccessible(page, "liste des campagnes");

    // Rename in place: Escape cancels, Enter saves.
    await page.getByRole("button", { name: new RegExp(`Nom de la campagne : ${DEMO}`) }).click();
    await page.keyboard.press("Control+A");
    await page.keyboard.type("Nom annulé");
    await page.keyboard.press("Escape");
    await expect(page.getByText(DEMO, { exact: true }).first()).toBeVisible();

    await page.getByRole("button", { name: new RegExp(`Nom de la campagne : ${DEMO}`) }).click();
    await page.keyboard.press("Control+A");
    await page.keyboard.type(`${DEMO} — automne`);
    await page.keyboard.press("Enter");
    await expect(page.getByText("Campagne renommée.")).toBeVisible();

    const renamed = `${DEMO} — automne`;
    await page.getByRole("button", { name: `Actions pour ${renamed}` }).click();
    await page.getByRole("menuitem", { name: "Archiver" }).click();
    await expect(page.getByText(`« ${renamed} » est archivée.`)).toBeVisible();
    await page.getByRole("button", { name: "Annuler" }).click();
    await expect(page.getByRole("link", { name: `Ouvrir : ${renamed}` })).toBeVisible();

    await page.getByRole("button", { name: `Actions pour ${renamed}` }).click();
    await page.getByRole("menuitem", { name: "Dupliquer…" }).click();
    await page.getByRole("button", { name: "Dupliquer", exact: true }).click();
    await expect(page.getByText(`« ${renamed} (copie) » a été créée.`)).toBeVisible();
    await expect(page.getByRole("link", { name: `Ouvrir : ${renamed} (copie)` })).toBeVisible();
  });
});
