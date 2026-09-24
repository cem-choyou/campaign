import { BRAND, expect, expectAccessible, signInAs, test } from "./fixtures";

test.describe("connexion", () => {
  test("un visiteur est renvoyé vers la connexion puis vers la page demandée", async ({ page }) => {
    await page.goto(`${BRAND}/campagnes`);
    await expect(page).toHaveURL(/\/connexion\?callbackUrl=%2Fit-for-business%2Fcampagnes/);
    await expect(page.getByRole("heading", { name: "Connexion à Campaign" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Continuer avec Google" })).toBeVisible();
    await expectAccessible(page, "connexion");

    await signInAs(page, "admin");
    await page.goto("/connexion?callbackUrl=%2Fit-for-business%2Fcampagnes");
    await expect(page).toHaveURL(new RegExp(`${BRAND}/campagnes$`));
  });

  test("une adresse inconnue voit la même confirmation (pas d'énumération)", async ({ page }) => {
    await page.goto("/connexion");
    await page.getByLabel("Adresse e-mail").fill("inconnu@example.org");
    await page.getByRole("button", { name: "Recevoir un lien de connexion" }).click();
    await expect(page).toHaveURL(/\/connexion\/envoye$/);
    await expect(page.getByRole("heading", { name: "Vérifiez votre boîte mail" })).toBeVisible();
  });

  test("les en-têtes de sécurité sont présents", async ({ request }) => {
    const res = await request.get("/connexion");
    const h = res.headers();
    expect(h["content-security-policy"]).toContain("frame-ancestors 'none'");
    expect(h["strict-transport-security"]).toContain("max-age=31536000");
    expect(h["x-content-type-options"]).toBe("nosniff");
    expect(h["referrer-policy"]).toBe("strict-origin-when-cross-origin");
  });
});
