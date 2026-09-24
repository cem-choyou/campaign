import type { Page } from "@playwright/test";
import { E2E } from "./config";
import { BRAND, expect, expectAccessible, test } from "./fixtures";

// AI_TRANSPORT=mock: texts are canned and marked « [Texte de test] ».

async function openPost(page: Page, rowText: string) {
  await page.context().addCookies([{ name: "planning-mode", value: "list", url: E2E.baseURL }]);
  await page.goto(`${BRAND}/campagnes`);
  await page
    .getByRole("link", { name: /^Ouvrir : Promotion vidéo LDDLT/ })
    .first()
    .click();
  await page.locator("tbody tr", { hasText: rowText }).first().getByRole("button").first().click();
  await expect(page).toHaveURL(/\?post=/);
}

test("proposer, retoucher et revenir à une version d'un post LinkedIn", async ({
  asAdmin: page,
}) => {
  await openPost(page, "CAP2");
  const dialog = page.getByRole("dialog");
  const body = dialog.locator("#post-body");
  const saved = dialog.getByText("Enregistré", { exact: true }).first();
  // Each edit goes through « Enregistrement… » before « Enregistré » (800 ms debounce).
  const waitSaved = async () => {
    await expect(dialog.getByText("Enregistrement…").first()).toBeVisible();
    await expect(saved).toBeVisible({ timeout: 10_000 });
  };

  await dialog.getByRole("button", { name: "Générer 3 propositions" }).click();
  const second = dialog.getByRole("article", { name: "Proposition 2" });
  await expect(second).toContainText("30 % de tickets en moins");
  await expect(dialog.getByRole("article", { name: "Proposition 3" })).toContainText(
    "Trois DSI racontent",
  );
  for (const button of await dialog.getByRole("button", { name: "Utiliser celle-ci" }).all()) {
    await expect(button).toBeEnabled();
  }
  await expectAccessible(page, "panneau IA de l'éditeur");

  await second.getByRole("button", { name: "Utiliser celle-ci" }).click();
  await expect(body).toHaveValue(/30 % de tickets en moins/);
  await waitSaved();

  await dialog.getByRole("button", { name: "Plus court" }).click();
  const retouched = dialog.getByRole("article", { name: "Texte retouché" });
  await expect(retouched).toContainText("[Modifié");
  await retouched.getByRole("button", { name: "Remplacer le texte" }).click();
  await expect(body).toHaveValue(/\[Modifié/);
  await waitSaved();

  // History: two AI versions, go back to the first proposal.
  await dialog.getByRole("button", { name: "Historique" }).click();
  await expect(page.getByText("Versions du texte")).toBeVisible();
  await expect(page.getByText("Version actuelle")).toBeVisible();
  await page.getByRole("button", { name: "Revenir à cette version" }).first().click();
  await expect(body).toHaveValue(/30 % de tickets en moins/);
  await expect(body).not.toHaveValue(/\[Modifié/);
  await waitSaved();
});

test("proposer le titre et la description d'un Short", async ({ asAdmin: page }) => {
  await openPost(page, "SHORT2");
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("button", { name: "Proposer titre, description et tags" }).click();
  const proposal = dialog.getByRole("article", { name: "Proposition YouTube" });
  await expect(proposal).toContainText("[Test]");
  await expect(proposal).toContainText("#Shorts");
  await proposal.getByRole("button", { name: "Utiliser cette proposition" }).click();
  await expect(dialog.locator("#yt-title")).toHaveValue(/^\[Test\]/);
  await expect(dialog.locator("#yt-desc")).toHaveValue(/#Shorts/);
  await expect(dialog.getByText("Enregistré", { exact: true }).first()).toBeVisible({
    timeout: 10_000,
  });
});
