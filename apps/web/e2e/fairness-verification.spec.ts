import { test, expect } from '@playwright/test';

/**
 * QA-201: Wave 5 fairness verification — budget caps, reservations, exhaustion.
 *
 * See docs/wave5-fairness-test-plan.md for the full matrix and traceability.
 */
test.describe('Maintainer budget dashboard', () => {
  test('shows org and repo scopes with consumption breakdown', async ({ page }) => {
    await page.goto('/budgets');

    await expect(page.getByRole('heading', { name: /budget dashboard/i })).toBeVisible();
    await expect(page.getByText(/org: stellar-org/i)).toBeVisible();
    await expect(page.getByText(/repo: soroban-dev-console/i)).toBeVisible();
    await expect(page.getByText(/consumed:/i).first()).toBeVisible();
    await expect(page.getByText(/reserved:/i).first()).toBeVisible();
  });

  test('warns when repo scope is near budget exhaustion', async ({ page }) => {
    await page.goto('/budgets');

    await expect(
      page.getByText(/budget nearly exhausted for this scope/i),
    ).toBeVisible();
  });

  test('shows burn-rate pace and at-risk countdown for repo scope', async ({ page }) => {
    await page.goto('/budgets');

    await expect(page.getByText(/~\d+d remaining/i).first()).toBeVisible();
    await expect(page.getByText(/pts\/day/i).first()).toBeVisible();
  });

  test('repo-exhausted fixture shows zero remaining headroom', async ({ page }) => {
    await page.goto('/budgets?fixture=repo-exhausted');

    await expect(page.getByText(/repo: soroban-dev-console/i)).toBeVisible();
    await expect(page.getByText(/0 \/ 10,000 pts remaining/i)).toBeVisible();
    await expect(page.getByText(/~0d remaining/i)).toBeVisible();
  });
});

test.describe('Fairness filters (maintainer workflow)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/budgets');
  });

  test('exposes budget headroom sort and filter toggles', async ({ page }) => {
    await page.getByRole('button', { name: /fairness filters/i }).click();

    const sortSelect = page.locator('#fairness-sort');
    await expect(sortSelect).toBeVisible();
    await expect(sortSelect).toContainText(/most budget headroom/i);
    await expect(page.getByLabel(/has remaining budget headroom/i)).toBeVisible();
  });

  test('tracks active filter count when budget headroom filter enabled', async ({ page }) => {
    await page.getByRole('button', { name: /fairness filters/i }).click();
    await page.getByLabel(/has remaining budget headroom/i).check();

    await expect(page.getByRole('button', { name: /fairness filters/i })).toContainText('1');
    await expect(page.getByRole('button', { name: /clear/i })).toBeVisible();
  });
});

test.describe('Budget notifications and discovery', () => {
  test('notifications surface budget alerts linking to dashboard', async ({ page }) => {
    await page.goto('/notifications');

    await page.getByRole('button', { name: /^budget$/i }).click();
    await expect(page.getByText(/budget nearly exhausted/i)).toBeVisible();
    await expect(
      page.getByRole('link', { name: /budget nearly exhausted/i }),
    ).toHaveAttribute('href', '/budgets');
  });
});
