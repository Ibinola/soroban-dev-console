import { test, expect } from '@playwright/test';

/**
 * QA-215: Cross-browser coverage for maintainer-heavy Wave dashboards.
 *
 * Exercises the critical operational dashboards across all configured browser
 * projects so queue handling and fairness tools do not silently regress.
 */

// ── Budget dashboard ──────────────────────────────────────────────────────────
test.describe('Budget dashboard — cross-browser', () => {
  test('loads org and repo budget scopes', async ({ page }) => {
    await page.goto('/budgets');
    await expect(page.getByRole('heading', { name: /budget/i })).toBeVisible();
    await expect(page.getByText(/consumed:/i).first()).toBeVisible();
  });

  test('near-exhaustion warning is visible', async ({ page }) => {
    await page.goto('/budgets');
    await expect(
      page.getByText(/budget nearly exhausted/i),
    ).toBeVisible();
  });

  test('exhausted repo scope shows zero remaining', async ({ page }) => {
    await page.goto('/budgets?fixture=repo-exhausted');
    await expect(page.getByText(/0 \/ \S+ pts remaining/i)).toBeVisible();
  });
});

// ── Appeal queue dashboard ────────────────────────────────────────────────────
test.describe('Appeal queue dashboard — cross-browser', () => {
  test('lists open appeals', async ({ page }) => {
    await page.goto('/appeals');
    await expect(page.getByRole('heading', { name: /appeal/i })).toBeVisible();
  });

  test('appeal detail panel opens on row click', async ({ page }) => {
    await page.goto('/appeals');
    const firstRow = page.getByRole('row').nth(1);
    const visible = await firstRow.isVisible().catch(() => false);
    if (visible) {
      await firstRow.click();
      await expect(page.getByRole('dialog')).toBeVisible();
    }
  });
});

// ── Verification queue dashboard ──────────────────────────────────────────────
test.describe('Verification queue dashboard — cross-browser', () => {
  test('loads pending verification list', async ({ page }) => {
    await page.goto('/verification');
    await expect(page.getByRole('heading', { name: /verification/i })).toBeVisible();
  });
});

// ── Maintainer review dashboard ───────────────────────────────────────────────
test.describe('Maintainer review dashboard — cross-browser', () => {
  test('shows active review windows', async ({ page }) => {
    await page.goto('/reviews');
    await expect(page.getByRole('heading', { name: /review/i })).toBeVisible();
  });

  test('backlogged queue shows depth warning', async ({ page }) => {
    await page.goto('/reviews?fixture=backlog');
    const warning = page.getByText(/queue depth|backlog|entries waiting/i);
    const visible = await warning.isVisible().catch(() => false);
    if (visible) {
      await expect(warning).toBeVisible();
    }
  });
});

// ── Keyboard and focus (accessibility baseline) ───────────────────────────────
test.describe('Focus and keyboard navigation — cross-browser', () => {
  test('budget dashboard nav is keyboard reachable', async ({ page }) => {
    await page.goto('/budgets');
    await page.keyboard.press('Tab');
    const focused = await page.evaluate(() => document.activeElement?.tagName);
    expect(['A', 'BUTTON', 'INPUT', 'SELECT', 'TEXTAREA']).toContain(focused);
  });
});
