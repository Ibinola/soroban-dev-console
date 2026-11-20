import { test, expect } from '@playwright/test';

// #1409: keyboard navigation for transaction review
test('transaction review dialog is keyboard operable', async ({ page }) => {
  await page.goto('/');
  const dialog = page.getByRole('dialog');
  // Open the review dialog via the primary invoke action (assumes a button named /review|invoke/i).
  await page.getByRole('button', { name: /review|invoke/i }).first().focus();
  await page.keyboard.press('Enter');
  await expect(dialog).toBeVisible();

  // Focus stays inside the dialog while tabbing.
  for (let i = 0; i < 6; i++) await page.keyboard.press('Tab');
  expect(await dialog.evaluate((el) => el.contains(document.activeElement))).toBe(true);

  // Escape closes it.
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
});
