import { test, expect } from '@playwright/test';

// #1404: browser test for offline recovery
test('app recovers after going offline and back online', async ({ page, context }) => {
  await page.goto('/');
  await context.setOffline(true);
  await page.reload().catch(() => {});
  await context.setOffline(false);
  await page.reload();
  await expect(page.locator('body')).toBeVisible();
  await expect(page.getByText(/something went wrong|unexpected error/i)).toHaveCount(0);
});
