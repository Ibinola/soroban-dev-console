import { test, expect, APIRequestContext } from "@playwright/test";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

interface TokenPair {
  supportToken: string;
  contributorToken: string;
  maintainerToken: string;
}

/**
 * Obtain short-lived JWTs for each actor role.
 * Uses the test-seeded credentials from .env.test or environment variables.
 */
async function getTokens(request: APIRequestContext): Promise<TokenPair> {
  const login = async (email: string, password: string) => {
    const res = await request.post(`${API_BASE}/api/auth/login`, {
      data: { email, password },
    });
    expect(res.ok(), `Login failed for ${email}`).toBeTruthy();
    const body = await res.json();
    return body.token as string;
  };

  const [supportToken, contributorToken, maintainerToken] = await Promise.all([
    login(
      process.env.SUPPORT_EMAIL ?? "support@example.com",
      process.env.SUPPORT_PASSWORD ?? "password"
    ),
    login(
      process.env.CONTRIBUTOR_EMAIL ?? "contributor@example.com",
      process.env.CONTRIBUTOR_PASSWORD ?? "password"
    ),
    login(
      process.env.MAINTAINER_EMAIL ?? "maintainer@example.com",
      process.env.MAINTAINER_PASSWORD ?? "password"
    ),
  ]);

  return { supportToken, contributorToken, maintainerToken };
}

/** POST a JSON body and assert 2xx. */
async function apiPost(
  request: APIRequestContext,
  path: string,
  body: object,
  token: string
) {
  const res = await request.post(`${API_BASE}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
    data: body,
  });
  expect(res.ok(), `POST ${path} failed: ${await res.text()}`).toBeTruthy();
  return res.json();
}

/** PATCH a JSON body and assert 2xx. */
async function apiPatch(
  request: APIRequestContext,
  path: string,
  body: object,
  token: string
) {
  const res = await request.patch(`${API_BASE}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
    data: body,
  });
  expect(res.ok(), `PATCH ${path} failed: ${await res.text()}`).toBeTruthy();
  return res.json();
}

/** GET and assert 2xx. */
async function apiGet(
  request: APIRequestContext,
  path: string,
  token: string
) {
  const res = await request.get(`${API_BASE}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  expect(res.ok(), `GET ${path} failed: ${await res.text()}`).toBeTruthy();
  return res.json();
}

test.describe("QA-211 | Support-assisted verification – smoke", () => {
  let tokens: TokenPair;

  test.beforeAll(async ({ request }) => {
    tokens = await getTokens(request);
  });

  test("support agent can fetch the pending-verification queue", async ({ request }) => {
    const data = await apiGet(request, "/api/support/verification/pending", tokens.supportToken);
    expect(Array.isArray(data.items)).toBe(true);
    // Shape check – each item must expose the fields the UI depends on
    if (data.items.length > 0) {
      const item = data.items[0];
      expect(item).toHaveProperty("contributorId");
      expect(item).toHaveProperty("status");
      expect(item).toHaveProperty("submittedAt");
    }
  });

  test("support agent can manually approve a verification submission", async ({ request }) => {
    // Create a fresh submission first so the test is self-contained
    const submission = await apiPost(
      request,
      "/api/contributor/verification/submit",
      { documentType: "github_profile", documentUrl: "https://github.com/fixture-user" },
      tokens.contributorToken
    );
    expect(submission).toHaveProperty("submissionId");

    // Support approves it
    const approval = await apiPatch(
      request,
      `/api/support/verification/${submission.submissionId}/approve`,
      { note: "Smoke-test approval" },
      tokens.supportToken
    );
    expect(approval.status).toBe("approved");

    // Contributor status should now reflect approval
    const status = await apiGet(
      request,
      "/api/contributor/verification/status",
      tokens.contributorToken
    );
    expect(status.verificationStatus).toBe("approved");
  });

  test("support agent can manually reject a verification submission", async ({ request }) => {
    const submission = await apiPost(
      request,
      "/api/contributor/verification/submit",
      { documentType: "github_profile", documentUrl: "https://github.com/fixture-user-2" },
      tokens.contributorToken
    );

    const rejection = await apiPatch(
      request,
      `/api/support/verification/${submission.submissionId}/reject`,
      { reason: "Insufficient evidence", note: "Smoke-test rejection" },
      tokens.supportToken
    );
    expect(rejection.status).toBe("rejected");
    expect(rejection.reason).toBe("Insufficient evidence");
  });

  test("product state remains consistent after support override", async ({ request }) => {
    // Verify that after support approves, a second approval attempt is idempotent / errors cleanly
    const submission = await apiPost(
      request,
      "/api/contributor/verification/submit",
      { documentType: "github_profile", documentUrl: "https://github.com/fixture-user-3" },
      tokens.contributorToken
    );

    await apiPatch(
      request,
      `/api/support/verification/${submission.submissionId}/approve`,
      { note: "First approval" },
      tokens.supportToken
    );

    // Second attempt on an already-settled submission
    const res = await request.patch(
      `${API_BASE}/api/support/verification/${submission.submissionId}/approve`,
      {
        headers: { Authorization: `Bearer ${tokens.supportToken}` },
        data: { note: "Duplicate approval" },
      }
    );
    // Must return 409 Conflict or 422 Unprocessable – NOT 500
    expect([409, 422]).toContain(res.status());
  });

  test("contributor cannot access support-only verification endpoints", async ({ request }) => {
    const res = await request.get(`${API_BASE}/api/support/verification/pending`, {
      headers: { Authorization: `Bearer ${tokens.contributorToken}` },
    });
    expect(res.status()).toBe(403);
  });
});

test.describe("QA-211 | Support-assisted appeals – smoke", () => {
  let tokens: TokenPair;
  let appealId: string;

  test.beforeAll(async ({ request }) => {
    tokens = await getTokens(request);

    // Pre-create an appeal so individual tests can reference it
    const appeal = await apiPost(
      request,
      "/api/contributor/appeals",
      {
        reason: "Wrongful rejection",
        description: "My submission was valid. Smoke-test appeal.",
        attachments: [],
      },
      tokens.contributorToken
    );
    appealId = appeal.appealId;
  });

  test("support agent can list open appeals", async ({ request }) => {
    const data = await apiGet(request, "/api/support/appeals?status=open", tokens.supportToken);
    expect(Array.isArray(data.items)).toBe(true);
  });

  test("support agent can retrieve appeal detail", async ({ request }) => {
    const detail = await apiGet(
      request,
      `/api/support/appeals/${appealId}`,
      tokens.supportToken
    );
    expect(detail.appealId).toBe(appealId);
    expect(detail).toHaveProperty("reason");
    expect(detail).toHaveProperty("status");
    expect(detail).toHaveProperty("createdAt");
  });

  test("support agent can add an internal note to an appeal", async ({ request }) => {
    const note = await apiPost(
      request,
      `/api/support/appeals/${appealId}/notes`,
      { content: "Reviewed evidence. Looks legitimate.", internal: true },
      tokens.supportToken
    );
    expect(note).toHaveProperty("noteId");
    expect(note.internal).toBe(true);
  });

  test("support agent can escalate an appeal to a maintainer", async ({ request }) => {
    const escalation = await apiPatch(
      request,
      `/api/support/appeals/${appealId}/escalate`,
      { assignTo: "maintainer", reason: "Requires maintainer review" },
      tokens.supportToken
    );
    expect(escalation.status).toBe("escalated");
    expect(escalation.assignedRole).toBe("maintainer");
  });

  test("maintainer can resolve an escalated appeal", async ({ request }) => {
    const resolution = await apiPatch(
      request,
      `/api/maintainer/appeals/${appealId}/resolve`,
      { decision: "upheld", note: "Appeal is valid. Overriding rejection." },
      tokens.maintainerToken
    );
    expect(resolution.status).toBe("resolved");
    expect(resolution.decision).toBe("upheld");

    // Contributor state must reflect the decision
    const contribStatus = await apiGet(
      request,
      "/api/contributor/appeals/status",
      tokens.contributorToken
    );
    const myAppeal = contribStatus.appeals.find((a: { appealId: string }) => a.appealId === appealId);
    expect(myAppeal?.status).toBe("resolved");
    expect(myAppeal?.decision).toBe("upheld");
  });

  test("resolved appeal cannot be re-opened without elevated permissions", async ({ request }) => {
    const res = await request.patch(
      `${API_BASE}/api/contributor/appeals/${appealId}/reopen`,
      {
        headers: { Authorization: `Bearer ${tokens.contributorToken}` },
        data: { reason: "Trying to reopen" },
      }
    );
    expect([403, 422]).toContain(res.status());
  });

  test("notification is dispatched after appeal resolution", async ({ request }) => {
    // Poll notification log – in real CI this would be a queue assertion or webhook capture
    const notifications = await apiGet(
      request,
      `/api/contributor/notifications?appealId=${appealId}`,
      tokens.contributorToken
    );
    const resolution = notifications.items.find(
      (n: { type: string }) => n.type === "appeal_resolved"
    );
    expect(resolution).toBeDefined();
    expect(resolution.read).toBe(false); // Fresh notification should be unread
  });
});

test.describe("QA-211 | Support console UI – smoke", () => {
  test("support agent can log in and reach the appeals dashboard", async ({ page }) => {
    await page.goto("/login");
    await page.fill('[data-testid="email-input"]', process.env.SUPPORT_EMAIL ?? "support@example.com");
    await page.fill('[data-testid="password-input"]', process.env.SUPPORT_PASSWORD ?? "password");
    await page.click('[data-testid="login-submit"]');
    await page.waitForURL("**/dashboard**");
    await page.goto("/support/appeals");
    await expect(page.locator('[data-testid="appeals-list"]')).toBeVisible();
  });

  test("support agent sees status badge update in UI after approving verification", async ({ page, request }) => {
    const tokens = await getTokens(request);

    const submission = await apiPost(
      request,
      "/api/contributor/verification/submit",
      { documentType: "github_profile", documentUrl: "https://github.com/ui-smoke-user" },
      tokens.contributorToken
    );

    // Log in as support in browser
    await page.goto("/login");
    await page.fill('[data-testid="email-input"]', process.env.SUPPORT_EMAIL ?? "support@example.com");
    await page.fill('[data-testid="password-input"]', process.env.SUPPORT_PASSWORD ?? "password");
    await page.click('[data-testid="login-submit"]');
    await page.waitForURL("**/dashboard**");

    await page.goto(`/support/verification/${submission.submissionId}`);
    await page.click('[data-testid="approve-button"]');

    // Optimistic UI or polling should show "approved" badge
    await expect(
      page.locator('[data-testid="verification-status-badge"]')
    ).toHaveText(/approved/i, { timeout: 10_000 });
  });
});
