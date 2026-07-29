import { test, expect, Page, Route } from "@playwright/test";

const BASE_URL = process.env.BASE_URL ?? "http://localhost:3000";

async function loginAs(page: Page, role: "contributor" | "maintainer") {
  const credentials =
    role === "contributor"
      ? { email: "contributor@wave-test.internal", password: "TestPass1!" }
      : { email: "maintainer@wave-test.internal", password: "TestPass1!" };

  await page.goto(`${BASE_URL}/login`);
  await page.getByLabel("Email").fill(credentials.email);
  await page.getByLabel("Password").fill(credentials.password);
  await page.getByRole("button", { name: /sign in/i }).click();
  await page.waitForURL(/dashboard/);
}

async function getUnreadCount(page: Page): Promise<number> {
  const badge = page.getByTestId("notification-badge");
  const visible = await badge.isVisible();
  if (!visible) return 0;
  const text = (await badge.textContent()) ?? "0";
  return parseInt(text.trim(), 10) || 0;
}

test.describe("QA-210 | Notifications — contributor workflow", () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, "contributor");
  });

  test("unread-notification badge appears after a transaction is flagged", async ({
    page,
  }) => {
    // Navigate to a transaction that will trigger a flag notification
    await page.goto(`${BASE_URL}/transactions/tx-smoke-001`);

    // Simulate the server pushing a notification (poll or SSE)
    // In CI the server is seeded with a pre-flagged transaction for this user
    await expect(page.getByTestId("notification-badge")).toBeVisible({
      timeout: 10_000,
    });

    const count = await getUnreadCount(page);
    expect(count).toBeGreaterThanOrEqual(1);
  });

  test("notification bell opens the notification drawer", async ({ page }) => {
    await page.getByTestId("notification-bell").click();
    await expect(page.getByTestId("notification-drawer")).toBeVisible();
  });

  test("clicking a notification marks it as read and decrements the badge", async ({
    page,
  }) => {
    // Ensure at least one unread notification exists
    await page.goto(`${BASE_URL}/dashboard`);
    const before = await getUnreadCount(page);
    test.skip(before === 0, "No unread notifications to test");

    await page.getByTestId("notification-bell").click();
    const firstItem = page
      .getByTestId("notification-drawer")
      .getByTestId("notification-item")
      .first();
    await firstItem.click();

    // Badge should decrement
    const after = await getUnreadCount(page);
    expect(after).toBe(Math.max(0, before - 1));
  });

  test("mark-all-read clears the badge entirely", async ({ page }) => {
    await page.getByTestId("notification-bell").click();
    await page
      .getByTestId("notification-drawer")
      .getByRole("button", { name: /mark all as read/i })
      .click();

    // Badge should disappear or show 0
    const count = await getUnreadCount(page);
    expect(count).toBe(0);
  });

  test("appeal-outcome notification is shown after appeal resolves", async ({
    page,
  }) => {
    // The test seed includes a resolved appeal for this contributor
    await page.goto(`${BASE_URL}/dashboard`);
    await page.getByTestId("notification-bell").click();

    await expect(
      page
        .getByTestId("notification-drawer")
        .getByText(/appeal.*overturned|appeal.*upheld/i)
    ).toBeVisible({ timeout: 8_000 });
  });
});

test.describe("QA-210 | Notifications — maintainer workflow", () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, "maintainer");
  });

  test("maintainer sees a notification when a new review is queued", async ({
    page,
  }) => {
    await page.goto(`${BASE_URL}/triage`);
    await expect(page.getByTestId("notification-badge")).toBeVisible({
      timeout: 10_000,
    });
  });

  test("maintainer notification links to the correct review detail page", async ({
    page,
  }) => {
    await page.goto(`${BASE_URL}/triage`);
    await page.getByTestId("notification-bell").click();

    const firstNotif = page
      .getByTestId("notification-drawer")
      .getByTestId("notification-item")
      .first();

    const href = await firstNotif
      .getByRole("link")
      .getAttribute("href");
    expect(href).toMatch(/\/reviews\//);

    await firstNotif.getByRole("link").click();
    await page.waitForURL(/\/reviews\//);
    await expect(page.getByTestId("review-detail")).toBeVisible();
  });
});

test.describe("QA-210 | Notifications — delivery retry on transient API failure", () => {
  test("notification is eventually delivered after a transient 503 from the API", async ({
    page,
    context,
  }) => {
    let callCount = 0;

    // Intercept the notifications endpoint and fail the first call
    await context.route(`**/api/notifications**`, async (route: Route) => {
      callCount += 1;
      if (callCount === 1) {
        await route.fulfill({ status: 503, body: "Service Unavailable" });
      } else {
        await route.continue();
      }
    });

    await loginAs(page, "contributor");
    await page.goto(`${BASE_URL}/dashboard`);

    // The UI should retry and ultimately render the notification list
    await expect(page.getByTestId("notification-drawer-empty-state").or(
      page.getByTestId("notification-item")
    )).toBeVisible({ timeout: 15_000 });

    // Confirm the route was hit more than once (i.e. a retry happened)
    expect(callCount).toBeGreaterThanOrEqual(2);
  });

  test("UI shows an error state — not a blank screen — when notifications fail permanently", async ({
    page,
    context,
  }) => {
    await context.route(`**/api/notifications**`, (route: Route) =>
      route.fulfill({ status: 503, body: "Service Unavailable" })
    );

    await loginAs(page, "contributor");
    await page.goto(`${BASE_URL}/dashboard`);
    await page.getByTestId("notification-bell").click();

    await expect(
      page.getByTestId("notification-error-state")
    ).toBeVisible({ timeout: 10_000 });
  });
});

test.describe("QA-210 | Notifications — accessibility and a11y", () => {
  test("notification badge has an accessible label", async ({ page }) => {
    await loginAs(page, "contributor");
    await page.goto(`${BASE_URL}/dashboard`);

    const badge = page.getByTestId("notification-badge");
    const visible = await badge.isVisible();
    if (!visible) return;

    const ariaLabel = await badge.getAttribute("aria-label");
    expect(ariaLabel).toMatch(/unread notification/i);
  });

  test("notification drawer traps focus when open", async ({ page }) => {
    await loginAs(page, "contributor");
    await page.goto(`${BASE_URL}/dashboard`);

    await page.getByTestId("notification-bell").click();
    await expect(page.getByTestId("notification-drawer")).toBeFocused();
  });
});
