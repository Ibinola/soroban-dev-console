import { test, expect } from "@playwright/test";

const criticalRoutes = [
  "/",
  "/contracts",
  "/tx-builder",
  "/appeals",
  "/verification",
];

for (const route of criticalRoutes) {
  test(`a11y smoke: ${route} has landmark, heading, and no un-labelled images`, async ({ page }) => {
    await page.goto(route);

    await expect(page).toHaveTitle(/.+/);

    const main = page.locator("main, [role=main]");
    await expect(main).toBeVisible();

    const headings = page.locator("h1, h2");
    await expect(headings.first()).toBeVisible();

    const unlabelledImages = page.locator("img:not([alt])");
    await expect(unlabelledImages).toHaveCount(0);
  });
}
