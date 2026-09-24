import type { Page } from "@playwright/test";
import { E2E } from "./config";
import { BRAND, expect, expectAccessible, test } from "./fixtures";

function addDays(date: string, days: number) {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

async function openDemo(page: Page, mode: "calendar" | "list") {
  await page.context().addCookies([
    { name: "planning-mode", value: mode, url: E2E.baseURL },
    { name: "calendar-view", value: "dayGridMonth", url: E2E.baseURL },
  ]);
  await page.goto(`${BRAND}/campagnes`);
  await page
    .getByRole("link", { name: /^Ouvrir : Promotion vidéo LDDLT/ })
    .first()
    .click();
  await expect(page.getByRole("link", { name: "Planning" })).toBeVisible();
}

test.describe("planning et éditeur", () => {
  test("glisser-déposer un post puis annuler", async ({ asAdmin: page }) => {
    await openDemo(page, "calendar");
    const monday = E2E.demoStart;
    const tuesday = addDays(monday, 1);
    const event = page.locator(`td[data-date="${monday}"] .post-event`).first();
    await expect(event).toBeVisible();
    await expectAccessible(page, "planning calendrier");

    await event.dragTo(page.locator(`td[data-date="${tuesday}"] .fc-daygrid-day-frame`));
    await expect(page.getByText(/^Déplacé au mardi/)).toBeVisible();
    await expect(page.locator(`td[data-date="${tuesday}"] .post-event`)).toHaveCount(1);

    await page.getByRole("button", { name: "Annuler" }).click();
    await expect(page.locator(`td[data-date="${tuesday}"] .post-event`)).toHaveCount(0);
    await expect(page.locator(`td[data-date="${monday}"] .post-event`)).toHaveCount(1);
  });

  test("créer un post au clic sur un jour et le rédiger dans le panneau", async ({
    asAdmin: page,
  }) => {
    await openDemo(page, "calendar");
    const friday = addDays(E2E.demoStart, 4);
    await page
      .locator(`td[data-date="${friday}"] .fc-daygrid-day-frame`)
      .click({ position: { x: 40, y: 60 } });
    await expect(page.getByRole("heading", { name: "Nouveau post" })).toBeVisible();
    await page.getByRole("button", { name: "Créer et rédiger" }).click();

    await expect(page).toHaveURL(/\?post=/);
    const body = page.locator("#post-body");
    await expect(body).toBeVisible();
    await body.fill("Nouveau texte rédigé pendant le test e2e.");
    await expect(page.getByRole("dialog").getByText("Enregistré").first()).toBeVisible({
      timeout: 10_000,
    });
    await expect(page.getByLabel("Aperçu LinkedIn")).toContainText("Nouveau texte rédigé");
    await expectAccessible(page, "éditeur de post");

    // Previous / next, then Escape closes the panel.
    await page.getByRole("button", { name: "Post précédent (K)" }).click();
    await expect(page).toHaveURL(/\?post=/);
    await page.keyboard.press("Escape");
    await expect(page).not.toHaveURL(/\?post=/);
  });

  test("décaler des posts en masse depuis la liste puis annuler", async ({ asAdmin: page }) => {
    await openDemo(page, "list");
    await expectAccessible(page, "planning liste");
    const firstDate = page.locator("tbody tr").first().locator("td").nth(1);
    const before = await firstDate.innerText();

    await page.getByRole("checkbox", { name: "Tout sélectionner" }).click();
    await page.getByRole("button", { name: "Décaler…" }).click();
    await page.getByLabel("Nombre de jours").fill("7");
    await page.getByRole("button", { name: "Décaler", exact: true }).click();
    await expect(page.getByText(/décalés? de 7 jours/)).toBeVisible();
    await expect(firstDate).not.toHaveText(before);

    await page.getByRole("button", { name: "Annuler" }).click();
    await expect(firstDate).toHaveText(before);
  });
});
