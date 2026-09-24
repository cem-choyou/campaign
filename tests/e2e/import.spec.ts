import ExcelJS from "exceljs";
import { E2E } from "./config";
import { BRAND, expect, expectAccessible, test } from "./fixtures";
import { lddltFile } from "./lddlt-file";

test("télécharger le modèle Excel de la marque", async ({ asAdmin: page }) => {
  const response = await page.request.get(`/api/templates/campagne?marque=it-for-business`);
  expect(response.status()).toBe(200);
  expect(response.headers()["content-disposition"]).toContain(
    "modele-campagne-it-for-business.xlsx",
  );
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load((await response.body()) as unknown as ArrayBuffer);
  expect(wb.worksheets.map((w) => w.name)).toEqual([
    "Lisez-moi",
    "Campagne",
    "Contenus",
    "Planning",
    "Relais",
    "Listes",
  ]);
  expect(wb.getWorksheet("Listes")!.getCell("D2").value).toBe("IT for Business");
});

test("importer le plan LDDLT : aperçu puis 18 posts créés", async ({ asAdmin: page }, info) => {
  const file = info.outputPath("lddlt.xlsx");
  await lddltFile(file);

  await page.goto(`${BRAND}/campagnes`);
  await page.getByRole("link", { name: "Importer un Excel" }).first().click();
  await expect(page.getByRole("heading", { name: "Importer un planning Excel" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Télécharger le modèle" })).toBeVisible();
  await expectAccessible(page, "import : dépôt");

  await page.getByLabel("Choisir un fichier").setInputFiles(file);
  await expect(page.getByText("Tout est prêt.")).toBeVisible();
  await expect(page.getByText("13 contenus · 18 posts · 6 missions relais")).toBeVisible();
  await expect(page.getByRole("table", { name: "Calendrier" })).toBeVisible();
  await expectAccessible(page, "import : aperçu");

  await page.getByRole("button", { name: "Créer 18 posts" }).click();
  await expect(page.getByRole("heading", { name: "Import terminé" })).toBeVisible();
  await expect(page.getByText("18 posts créés.")).toBeVisible();
  await page.getByRole("link", { name: "Ouvrir la campagne" }).click();
  await expect(page.getByRole("link", { name: "Planning" })).toBeVisible();
  await page.getByRole("link", { name: "Contenus" }).click();
  await expect(page.getByText("SHORT6", { exact: true })).toBeVisible();
});

test("corriger les erreurs d'un fichier sur place", async ({ asAdmin: page }, info) => {
  const file = info.outputPath("lddlt-erreurs.xlsx");
  await lddltFile(file, (planning) => {
    planning.getCell("E4").value = "Shorts"; // unknown account (row 4)
    planning.getCell("B5").value = "Lundii"; // unknown day (row 5)
  });

  await page.goto(`${BRAND}/campagnes/importer`);
  await page.getByLabel("Choisir un fichier").setInputFiles(file);
  await expect(page.getByText("2 erreurs à corriger")).toBeVisible();
  await expect(page.getByText("Compte « Shorts » inconnu", { exact: false })).toBeVisible();
  await expect(page.getByText("Jour « Lundii » inconnu.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Créer 18 posts" })).toBeDisabled();

  await page.getByRole("combobox", { name: "Ligne 4 : Compte" }).click();
  await page.getByRole("option", { name: "IT for Business YouTube" }).click();
  await expect(page.getByText("1 erreur à corriger")).toBeVisible();

  const monday = new Date(`${E2E.demoStart}T00:00:00Z`);
  monday.setUTCDate(monday.getUTCDate() + 7);
  await page.getByLabel("Ligne 5 : Date").fill(monday.toISOString().slice(0, 10));
  await expect(page.getByText("Tout est prêt.")).toBeVisible();
  await page.getByRole("button", { name: "Créer 18 posts" }).click();
  await expect(page.getByText("18 posts créés.")).toBeVisible();
});

test("un fichier qui ne suit pas le modèle est expliqué", async ({ asAdmin: page }, info) => {
  const file = info.outputPath("libre.xlsx");
  const wb = new ExcelJS.Workbook();
  wb.addWorksheet("Feuille 1").addRow(["Quelque chose", "Autre"]);
  await wb.xlsx.writeFile(file);
  await page.goto(`${BRAND}/campagnes/importer`);
  await page.getByLabel("Choisir un fichier").setInputFiles(file);
  await expect(page.getByText(/ne suit pas le modèle Campaign/)).toBeVisible();
});
