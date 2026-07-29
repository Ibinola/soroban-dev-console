import { test, expect } from '@playwright/test';

/**
 * QA-203: AI appeal intake and status handling.
 *
 * Covers contributor submission, status timeline stages, and maintainer
 * follow-up surfaces for Wave 5 case handling.
 */
test.describe('Contributor appeal intake', () => {
  test('shows structured evidence capture form fields', async ({ page }) => {
    await page.goto('/appeals/submit');

    await expect(page.getByRole('heading', { name: /^submit an appeal$/i }).first()).toBeVisible();
    await expect(page.getByLabel(/issue number/i)).toBeVisible();
    await expect(page.getByLabel(/appeal summary/i)).toBeVisible();
    await expect(page.getByLabel(/evidence type/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /\+ add item/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /submit appeal/i })).toBeVisible();
  });

  test('validates required fields before submission when verified', async ({ page }) => {
    await page.goto('/appeals/submit?fixture=verified');

    await expect(page.getByRole('alert').filter({ hasText: /verification required/i })).toHaveCount(0);

    await page.locator('form').evaluate((form) => {
      (form as HTMLFormElement).noValidate = true;
    });
    await page.getByRole('button', { name: /submit appeal/i }).click();
    await expect(page.getByText(/issue number and summary are required/i)).toBeVisible();
  });

  test('completes intake and links to status tracking', async ({ page }) => {
    await page.goto('/appeals/submit?fixture=verified');

    await page.getByLabel(/issue number/i).fill('42');
    await page.getByLabel(/appeal summary/i).fill('The automated review missed context from the linked PR.');
    await page.getByLabel(/evidence url/i).fill('https://github.com/example/repo/pull/99');
    await page.getByRole('button', { name: /submit appeal/i }).click();

    await expect(page.getByRole('status')).toContainText(/appeal submitted successfully/i);
    await expect(page.getByRole('link', { name: /appeal status/i })).toHaveAttribute(
      'href',
      '/appeals/status',
    );
  });
});

test.describe('Contributor appeal status timeline', () => {
  test('shows in-progress AI review stages', async ({ page }) => {
    await page.goto('/appeals/status');

    await expect(page.getByRole('heading', { name: /appeal #APL-001/i })).toBeVisible();
    await expect(page.getByText(/issue #42 — fix contract storage serialization/i)).toBeVisible();
    await expect(page.getByText(/^appeal submitted$/i)).toBeVisible();
    await expect(page.getByText(/^intake review$/i)).toBeVisible();
    await expect(page.getByText(/^ai analysis$/i)).toBeVisible();
    await expect(page.getByText(/^human review$/i)).toBeVisible();
    await expect(
      page.getByText(/processing is automatic/i),
    ).toBeVisible();
  });

  test('shows approved outcome when fixture=approved', async ({ page }) => {
    await page.goto('/appeals/status?fixture=approved');

    await expect(page.getByRole('heading', { name: /appeal #APL-002/i })).toBeVisible();
    await expect(
      page.locator('[class*="border-green"]').filter({ hasText: /appeal approved/i }),
    ).toBeVisible();
    await expect(page.getByText(/points will be credited/i)).toBeVisible();
    await expect(page.getByText(/processing is automatic/i)).toHaveCount(0);
  });
});

test.describe('Maintainer appeal handling', () => {
  test('ops queue surfaces appeal follow-up with status link', async ({ page }) => {
    await page.goto('/ops-queue');

    await expect(page.getByText(/appeal APL-002 — awaiting human review/i)).toBeVisible();
    await expect(page.getByText(/ai analysis complete/i)).toBeVisible();
    await expect(page.getByRole('link', { name: /appeal APL-002/i })).toHaveAttribute(
      'href',
      '/appeals/status',
    );
  });

  test('contributor trust card shows active appeal signal', async ({ page }) => {
    await page.goto('/ops-queue');

    await expect(page.getByText(/appeal active/i)).toBeVisible();
    await expect(page.getByText(/active appeal on issue #38/i)).toBeVisible();
  });

  test('notifications link appeal decisions to status page', async ({ page }) => {
    await page.goto('/notifications');

    await expect(page.getByText(/appeal decision reached/i)).toBeVisible();
    await expect(
      page.getByText(/your appeal for issue #38 has been approved/i),
    ).toBeVisible();
    await expect(page.getByRole('link', { name: /appeal decision reached/i })).toHaveAttribute(
      'href',
      '/appeals/status',
    );
  });
});
