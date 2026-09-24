import { BRAND, expect, expectAccessible, signInAs, test } from "./fixtures";

test("régler le prompt de la marque et le tester", async ({ asAdmin: page }) => {
  await page.goto(`${BRAND}/reglages/prompt`);
  await expect(page.getByRole("heading", { name: "Prompt de la marque" })).toBeVisible();
  await expect(page.getByLabel("Ton")).toHaveValue(/Expert mais accessible/);
  await expectAccessible(page, "prompt de la marque");

  // Autosave, then the value survives a reload.
  await page
    .getByLabel("Instructions supplémentaires")
    .fill("Toujours écrire IT for Business en entier.");
  await expect(page.getByText("Enregistré", { exact: true })).toBeVisible();

  const hashtags = page.getByLabel("Hashtags de la marque");
  await hashtags.fill("#Cloud Computing");
  await hashtags.press("Enter");
  await expect(page.getByText("#CloudComputing")).toBeVisible();
  await expect(page.getByText("Enregistré", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: "Ajouter un exemple" }).click();
  await page.getByLabel("Exemple 1", { exact: true }).fill("Un exemple de post qui a bien marché.");
  await expect(page.getByText("Enregistré", { exact: true })).toBeVisible();

  await page.reload();
  await expect(page.getByLabel("Instructions supplémentaires")).toHaveValue(
    "Toujours écrire IT for Business en entier.",
  );
  await expect(page.getByText("#CloudComputing")).toBeVisible();
  await expect(page.getByLabel("Exemple 1", { exact: true })).toHaveValue(
    "Un exemple de post qui a bien marché.",
  );

  // Sandbox: a trial post streams into the LinkedIn preview.
  await page.getByLabel("Sujet du post d'essai").fill("annoncer la vidéo LDDLT");
  await page.getByRole("button", { name: "Générer un post d'essai" }).click();
  const preview = page.getByRole("article", { name: "Aperçu LinkedIn" });
  await expect(preview).toContainText("[Texte de test] annoncer la vidéo LDDLT");
  await expect(page.getByRole("button", { name: "Générer à nouveau" })).toBeVisible();
});

test("un éditeur n'a pas accès au prompt de la marque", async ({ page }) => {
  await signInAs(page, "editor");
  const response = await page.goto(`${BRAND}/reglages/prompt`);
  expect(response?.status()).toBe(404);
});
