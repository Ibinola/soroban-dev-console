import { test, expect } from '@playwright/test';

const PAGES_TO_TEST = [
  { name: 'home', path: '/' },
  { name: 'contracts', path: '/contracts' },
  { name: 'deploy', path: '/deploy' },
  { name: 'tools', path: '/tools' },
  { name: 'tx', path: '/tx' },
  { name: 'settings', path: '/settings' },
];

for (const pageInfo of PAGES_TO_TEST) {
  test.describe(`Visual Regression: ${pageInfo.name} page`, () => {
    test(`should match light mode baseline`, async ({ page }) => {
      // Force light color scheme
      await page.emulateMedia({ colorScheme: 'light' });
      await page.goto(pageInfo.path, { waitUntil: 'networkidle' });

      // Visual comparison against baseline
      await expect(page).toHaveScreenshot(`${pageInfo.name}-light.png`, {
        maxDiffPixelRatio: 0.001, // 0.1% max diff threshold
        fullPage: true,
      });
    });

    test(`should match dark mode baseline`, async ({ page }) => {
      // Force dark color scheme / theme class
      await page.emulateMedia({ colorScheme: 'dark' });
      await page.goto(pageInfo.path, { waitUntil: 'networkidle' });

      // Ensure dark class is active on root if app uses class-based theming
      await page.evaluate(() => {
        document.documentElement.classList.add('dark');
      });

      // Visual comparison against baseline
      await expect(page).toHaveScreenshot(`${pageInfo.name}-dark.png`, {
        maxDiffPixelRatio: 0.001, // 0.1% max diff threshold
        fullPage: true,
      });
    });
  });
}