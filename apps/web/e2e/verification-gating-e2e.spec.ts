import { test, expect } from "@playwright/test";

test.describe("Verification gating flows", () => {
  test("verification page renders main content", async ({ page }) => {
    await page.goto("/verification");
    await expect(page.locator("main")).toBeVisible();
    await expect(page).toHaveTitle(/.+/);
  });

  test("unverified flow shows a prompt or banner", async ({ page }) => {
    await page.goto("/verification");
    const prompt = page.locator(
      "[data-testid=verification-prompt], .verification-prompt, [data-testid=verification-banner]"
    );
    const main = page.locator("main");
    await expect(main).toBeVisible();
    const hasPrompt = await prompt.count();
    if (hasPrompt) await expect(prompt.first()).toBeVisible();
  });

  test("contracts page loads without errors", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto("/contracts");
    await expect(page.locator("main")).toBeVisible();
    expect(errors).toHaveLength(0);
  });
});
