import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

/** Assert zero critical/serious violations and attach a report to the test. */
async function assertNoViolations(
  page: import("@playwright/test").Page,
  testInfo: import("@playwright/test").TestInfo,
  label: string
) {
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    // Exclude third-party widgets outside project control
    .exclude("#third-party-chat-widget")
    .analyze();

  // Attach full axe report so CI artifacts are diagnosable
  await testInfo.attach(`axe-report-${label}.json`, {
    body: JSON.stringify(results, null, 2),
    contentType: "application/json",
  });

  const blocking = results.violations.filter((v) =>
    ["critical", "serious"].includes(v.impact ?? "")
  );

  expect(
    blocking,
    `${blocking.length} critical/serious violation(s) on "${label}":\n` +
      blocking
        .map((v) => `  [${v.impact}] ${v.id}: ${v.description}`)
        .join("\n")
  ).toHaveLength(0);
}

/** Log in as a maintainer using env-supplied credentials. */
async function loginAsMaintainer(page: import("@playwright/test").Page) {
  await page.goto("/login");
  await page.fill('[data-testid="email-input"]', process.env.MAINTAINER_EMAIL ?? "maintainer@example.com");
  await page.fill('[data-testid="password-input"]', process.env.MAINTAINER_PASSWORD ?? "password");
  await page.click('[data-testid="login-submit"]');
  await page.waitForURL("**/dashboard**");
}

/** Log in as a contributor. */
async function loginAsContributor(page: import("@playwright/test").Page) {
  await page.goto("/login");
  await page.fill('[data-testid="email-input"]', process.env.CONTRIBUTOR_EMAIL ?? "contributor@example.com");
  await page.fill('[data-testid="password-input"]', process.env.CONTRIBUTOR_PASSWORD ?? "password");
  await page.click('[data-testid="login-submit"]');
  await page.waitForURL("**/dashboard**");
}

test.describe("QA-207 | Maintainer screens – accessibility", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsMaintainer(page);
  });

  test("maintainer dashboard has no critical a11y violations", async ({ page }, testInfo) => {
    await page.goto("/maintainer/dashboard");
    await page.waitForLoadState("networkidle");
    await assertNoViolations(page, testInfo, "maintainer-dashboard");
  });

  test("contributor queue screen has no critical a11y violations", async ({ page }, testInfo) => {
    await page.goto("/maintainer/queues/contributors");
    await page.waitForLoadState("networkidle");
    // Wait for queue rows to render before scanning
    await page.waitForSelector('[data-testid="queue-row"]', { timeout: 10_000 }).catch(() => {});
    await assertNoViolations(page, testInfo, "contributor-queue");
  });

  test("appeal review screen has no critical a11y violations", async ({ page }, testInfo) => {
    await page.goto("/maintainer/appeals");
    await page.waitForLoadState("networkidle");
    await assertNoViolations(page, testInfo, "maintainer-appeals");
  });

  test("appeal detail modal is accessible", async ({ page }, testInfo) => {
    await page.goto("/maintainer/appeals");
    await page.waitForLoadState("networkidle");

    const firstAppeal = page.locator('[data-testid="appeal-row"]').first();
    // Only run if there is at least one appeal in the fixture data
    if ((await firstAppeal.count()) > 0) {
      await firstAppeal.click();
      await page.waitForSelector('[role="dialog"]');
      await assertNoViolations(page, testInfo, "appeal-detail-modal");

      // Modal must trap focus
      const focused = page.locator(":focus");
      await expect(focused).toBeVisible();
    } else {
      test.skip(true, "No appeal fixtures available – skipping modal check");
    }
  });

  test("verification blocker screen has no critical a11y violations", async ({ page }, testInfo) => {
    await page.goto("/maintainer/verification/blockers");
    await page.waitForLoadState("networkidle");
    await assertNoViolations(page, testInfo, "verification-blockers");
  });

  test("budget indicators panel has no critical a11y violations", async ({ page }, testInfo) => {
    await page.goto("/maintainer/budget");
    await page.waitForLoadState("networkidle");
    // Budget charts must have accessible text alternatives
    const charts = page.locator('[data-testid="budget-chart"]');
    for (const chart of await charts.all()) {
      await expect(chart).toHaveAttribute("aria-label");
    }
    await assertNoViolations(page, testInfo, "budget-indicators");
  });

  test("keyboard navigation reaches all primary actions on maintainer dashboard", async ({ page }) => {
    await page.goto("/maintainer/dashboard");
    await page.waitForLoadState("networkidle");

    // Tab through interactive elements – none should be skipped (no focus trap outside modals)
    const interactiveSelector = 'a[href], button:not([disabled]), [role="button"]:not([disabled])';
    const elements = await page.locator(interactiveSelector).all();
    expect(elements.length).toBeGreaterThan(0);

    for (let i = 0; i < Math.min(elements.length, 20); i++) {
      await page.keyboard.press("Tab");
      const focused = await page.evaluate(() => document.activeElement?.tagName);
      expect(["A", "BUTTON", "INPUT", "SELECT", "TEXTAREA"]).toContain(focused?.toUpperCase());
    }
  });
});

// ─── Contributor screens ───────────────────────────────────────────────────

test.describe("QA-207 | Contributor screens – accessibility", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsContributor(page);
  });

  test("contributor dashboard has no critical a11y violations", async ({ page }, testInfo) => {
    await page.goto("/contributor/dashboard");
    await page.waitForLoadState("networkidle");
    await assertNoViolations(page, testInfo, "contributor-dashboard");
  });

  test("contributor verification status screen is accessible", async ({ page }, testInfo) => {
    await page.goto("/contributor/verification");
    await page.waitForLoadState("networkidle");
    await assertNoViolations(page, testInfo, "contributor-verification");
  });

  test("contributor appeal submission form is accessible", async ({ page }, testInfo) => {
    await page.goto("/contributor/appeals/new");
    await page.waitForLoadState("networkidle");
    await assertNoViolations(page, testInfo, "contributor-appeal-form");

    // Form labels must be associated with inputs
    const inputs = page.locator("form input, form textarea, form select");
    for (const input of await inputs.all()) {
      const id = await input.getAttribute("id");
      const ariaLabel = await input.getAttribute("aria-label");
      const ariaLabelledBy = await input.getAttribute("aria-labelledby");
      expect(
        id || ariaLabel || ariaLabelledBy,
        "Every form control must have an accessible label"
      ).toBeTruthy();
    }
  });

  test("error states on blocked verification screen are announced to screen readers", async ({ page }, testInfo) => {
    // Navigate to a blocked state by visiting a restricted route
    await page.goto("/contributor/verification/blocked");
    await page.waitForLoadState("networkidle");

    // The blocker message region must have role="alert" or aria-live
    const alertRegion = page.locator('[role="alert"], [aria-live]').first();
    await expect(alertRegion).toBeVisible();
    await assertNoViolations(page, testInfo, "contributor-verification-blocked");
  });

  test("colour contrast of budget indicator badges meets WCAG AA", async ({ page }, testInfo) => {
    await page.goto("/contributor/dashboard");
    await page.waitForLoadState("networkidle");

    const results = await new AxeBuilder({ page })
      .withTags(["wcag2aa"])
      .include('[data-testid="budget-badge"]')
      .analyze();

    const contrastViolations = results.violations.filter((v) => v.id === "color-contrast");

    await testInfo.attach("contrast-violations.json", {
      body: JSON.stringify(contrastViolations, null, 2),
      contentType: "application/json",
    });

    expect(
      contrastViolations,
      "Budget badges must meet WCAG AA contrast ratio"
    ).toHaveLength(0);
  });
});

test.describe("QA-207 | Shared screens – accessibility", () => {
  test("login page has no critical a11y violations", async ({ page }, testInfo) => {
    await page.goto("/login");
    await page.waitForLoadState("networkidle");
    await assertNoViolations(page, testInfo, "login-page");
  });

  test("page titles are unique and descriptive on all operation screens", async ({ page }) => {
    await loginAsMaintainer(page);

    const routes = [
      "/maintainer/dashboard",
      "/maintainer/queues/contributors",
      "/maintainer/appeals",
      "/maintainer/verification/blockers",
      "/maintainer/budget",
    ];

    const titles = new Set<string>();
    for (const route of routes) {
      await page.goto(route);
      await page.waitForLoadState("networkidle");
      const title = await page.title();
      expect(title.length, `Page title missing on ${route}`).toBeGreaterThan(0);
      expect(titles.has(title), `Duplicate page title "${title}" on ${route}`).toBe(false);
      titles.add(title);
    }
  });
});
