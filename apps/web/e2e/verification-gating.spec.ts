import { test, expect } from '@playwright/test';

/**
 * QA-202: Upfront verification gating for claim and payout-sensitive flows.
 *
 * Covers the contributor checklist and appeal intake surfaces that block
 * Wave actions until verification steps are complete.
 */
test.describe('Verification checklist gating', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/verification');
  });

  test('shows upfront verification requirements before Wave claiming', async ({ page }) => {
    await expect(page.getByRole('heading', { name: /contributor verification/i })).toBeVisible();
    await expect(
      page.getByText(/complete the steps below before claiming wave 5 issues/i),
    ).toBeVisible();
    await expect(
      page.getByText(/complete all steps above to unlock wave 5 issue claiming and rewards/i),
    ).toBeVisible();
  });

  test('lists all readiness steps with actionable next links', async ({ page }) => {
    await expect(page.getByText(/identity verification \(kyc\)/i)).toBeVisible();
    await expect(page.getByText(/connect a payout wallet/i)).toBeVisible();
    await expect(page.getByText(/eligibility check/i)).toBeVisible();
    await expect(page.getByText(/accept wave 5 terms/i)).toBeVisible();

    await expect(page.getByRole('link', { name: /start verification/i })).toHaveAttribute(
      'href',
      '/settings#kyc',
    );
    await expect(page.getByRole('link', { name: /check eligibility/i })).toHaveAttribute(
      'href',
      '/settings#eligibility',
    );
    await expect(page.getByRole('link', { name: /review terms/i })).toHaveAttribute(
      'href',
      '/settings#terms',
    );
    // Wallet step is complete in the demo state — no action link is shown.
    await expect(page.getByRole('link', { name: /connect wallet/i })).toHaveCount(0);
  });

  test('does not show all-complete state while steps remain pending', async ({ page }) => {
    await expect(page.getByText(/^all complete$/i)).toHaveCount(0);
    await expect(page.getByText(/connect a payout wallet/i)).toBeVisible();
  });
});

test.describe('Appeal intake verification gating', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/appeals/submit');
  });

  test('shows verification banner on appeal submission flow', async ({ page }) => {
    const banner = page.getByRole('alert').filter({ hasText: /verification required/i });
    await expect(banner).toBeVisible();
    await expect(banner.getByText(/verification required/i)).toBeVisible();
    await expect(
      banner.getByText(/complete identity verification to claim issues, submit reviews, or receive wave rewards/i),
    ).toBeVisible();
    await expect(banner.getByRole('link', { name: /start verification/i })).toHaveAttribute(
      'href',
      '/settings#kyc',
    );
  });

  test('blocks appeal submission UI until verification completes', async ({ page }) => {
    await expect(
      page.getByText(/verification is required to perform submit an appeal/i),
    ).toBeVisible();

    const gatedSurface = page.locator('[inert]');
    await expect(gatedSurface).toBeVisible();
    await expect(gatedSurface.getByRole('button', { name: /submit appeal/i })).toBeVisible();
  });
});

test.describe('Verification navigation surfaces', () => {
  test('ops queue links verification exceptions to the checklist', async ({ page }) => {
    await page.goto('/ops-queue');
    await expect(page.getByRole('link', { name: /verification exception/i })).toHaveAttribute(
      'href',
      '/verification',
    );
  });
});
