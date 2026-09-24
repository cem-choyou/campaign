import { E2E } from "./config";
import { BRAND, expect, expectAccessible, test } from "./fixtures";

// AI_TRANSPORT=mock: questions, brief, planning and texts are canned.

function addDays(date: string, days: number) {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

test("assistant avec l'IA : brief, planning proposé puis textes rédigés en masse", async ({
  asAdmin: page,
}) => {
  await page.goto(`${BRAND}/campagnes/nouvelle`);
  await page.getByLabel("Nom de la campagne").fill(`Campagne IA ${Date.now()}`);
  await page.getByLabel("Date de début").fill(E2E.demoStart);
  await page.getByLabel("Date de fin").fill(addDays(E2E.demoStart, 11)); // 2 weeks
  await expect(page).toHaveURL(/\/assistant$/, { timeout: 15_000 });

  // Step 2: brief written from three answers, with undo.
  await page.getByRole("button", { name: "Continuer" }).click();
  await page.getByRole("button", { name: "M'aider à écrire le brief" }).click();
  const dialog = page.getByRole("dialog", { name: "Écrire le brief avec l'IA" });
  await expect(dialog.getByLabel("À qui s'adresse en priorité cette campagne ?")).toBeVisible();
  await dialog.getByLabel("À qui s'adresse en priorité cette campagne ?").fill("Les DSI de PME.");
  await dialog.getByRole("button", { name: "Rédiger le brief" }).click();
  await expect(page.getByLabel("Cible")).toHaveValue("Les DSI de PME.");
  await expect(page.getByLabel("Brief détaillé")).toHaveValue(/\[Brief de test\]/);

  // Step 3: AI planning (2 weeks × page + YouTube), one proposal dropped.
  await page.getByRole("button", { name: "Continuer" }).click();
  await expect(
    page.getByRole("radio", { name: /Laisser l'IA proposer un planning/ }),
  ).toHaveAttribute("aria-checked", "true");
  await page.getByRole("button", { name: "Proposer un planning" }).click();
  await expect(page.getByText("4 publications proposées.", { exact: false })).toBeVisible();
  await expectAccessible(page, "assistant : planning proposé");
  await page.getByRole("checkbox").last().click();
  await page.getByRole("button", { name: "Créer 3 posts" }).click();
  await expect(page.getByText("3 posts créés dans le calendrier de la campagne.")).toBeVisible();

  // Step 4: the empty texts are written in bulk.
  await page.getByRole("button", { name: "Continuer" }).click();
  await expect(page.getByRole("heading", { name: "Récapitulatif" })).toBeVisible();
  await page.getByRole("button", { name: "Rédiger les textes avec l'IA" }).click();
  const bulk = page.getByRole("dialog", { name: "Rédiger les textes vides avec l'IA" });
  await expect(bulk.getByText("3 posts à rédiger.")).toBeVisible();
  await bulk.getByRole("button", { name: "Rédiger 3 textes" }).click();
  await expect(bulk.getByText("3 textes rédigés.")).toBeVisible();
  await bulk.getByRole("button", { name: "Fermer" }).first().click();
  await expect(page.getByRole("button", { name: "Rédiger les textes avec l'IA" })).toHaveCount(0);

  await page.getByRole("button", { name: "Ouvrir la campagne" }).click();
  await expect(page.getByRole("link", { name: "Planning" })).toBeVisible();
});

test("rédiger en masse depuis le planning d'une campagne, puis arrêter", async ({
  asAdmin: page,
}) => {
  await page.goto(`${BRAND}/campagnes`);
  await page
    .getByRole("link", { name: /^Ouvrir : Promotion vidéo LDDLT/ })
    .first()
    .click();
  await page.getByRole("button", { name: "Rédiger les textes avec l'IA" }).click();
  const bulk = page.getByRole("dialog", { name: "Rédiger les textes vides avec l'IA" });
  await expect(bulk.getByText(/posts à rédiger\./)).toBeVisible();
  await bulk.getByRole("button", { name: /^Rédiger \d+ textes$/ }).click();
  await bulk.getByRole("button", { name: "Arrêter" }).click();
  await expect(bulk.getByText(/^Rédaction arrêtée|textes? rédigés?\./)).toBeVisible({
    timeout: 30_000,
  });
});
