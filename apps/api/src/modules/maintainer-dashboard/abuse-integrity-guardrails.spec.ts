import { test, expect, APIRequestContext } from "@playwright/test";
import { v4 as uuid } from "uuid";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

/** Send a request with the test-mode bypass header so we hit sandbox limits. */
async function testPost(
  request: APIRequestContext,
  path: string,
  body: object,
  token: string,
  extra?: Record<string, string>
) {
  return request.post(`${API_BASE}${path}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      "X-Test-Client": "qa-abuse-suite",
      ...extra,
    },
    data: body,
  });
}

async function testGet(
  request: APIRequestContext,
  path: string,
  token: string
) {
  return request.get(`${API_BASE}${path}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      "X-Test-Client": "qa-abuse-suite",
    },
  });
}

async function getToken(request: APIRequestContext, role: "contributor" | "maintainer" | "support") {
  const credentials: Record<string, { email: string; password: string }> = {
    contributor: {
      email: process.env.CONTRIBUTOR_EMAIL ?? "contributor@example.com",
      password: process.env.CONTRIBUTOR_PASSWORD ?? "password",
    },
    maintainer: {
      email: process.env.MAINTAINER_EMAIL ?? "maintainer@example.com",
      password: process.env.MAINTAINER_PASSWORD ?? "password",
    },
    support: {
      email: process.env.SUPPORT_EMAIL ?? "support@example.com",
      password: process.env.SUPPORT_PASSWORD ?? "password",
    },
  };
  const creds = credentials[role];
  const res = await request.post(`${API_BASE}/api/auth/login`, {
    data: creds,
  });
  const body = await res.json();
  return body.token as string;
}

test.describe("QA-204 | Rate limiting guardrails", () => {
  test("appeal submission is rate-limited after repeated requests", async ({ request }) => {
    const token = await getToken(request, "contributor");
    const responses: number[] = [];

    // Fire requests above the expected per-minute ceiling (exact limit is opaque by design)
    for (let i = 0; i < 20; i++) {
      const res = await testPost(
        request,
        "/api/contributor/appeals",
        {
          reason: `Flood attempt ${i}`,
          description: uuid(), // unique per request to bypass dedup
          attachments: [],
        },
        token
      );
      responses.push(res.status());
    }

    // At least one response must be 429 – we do NOT assert at which index
    // to avoid encoding the internal threshold in the test.
    expect(responses).toContain(429);
  });

  test("verification submission is rate-limited for the same contributor", async ({ request }) => {
    const token = await getToken(request, "contributor");
    const results: number[] = [];

    for (let i = 0; i < 15; i++) {
      const res = await testPost(
        request,
        "/api/contributor/verification/submit",
        { documentType: "github_profile", documentUrl: `https://github.com/flood-${uuid()}` },
        token
      );
      results.push(res.status());
    }

    expect(results).toContain(429);
  });

  test("rate-limit response includes Retry-After header", async ({ request }) => {
    const token = await getToken(request, "contributor");
    let rateLimitedRes: Awaited<ReturnType<APIRequestContext["post"]>> | null = null;

    for (let i = 0; i < 20; i++) {
      const res = await testPost(
        request,
        "/api/contributor/appeals",
        { reason: `header-check ${i}`, description: uuid(), attachments: [] },
        token
      );
      if (res.status() === 429) {
        rateLimitedRes = res;
        break;
      }
    }

    if (rateLimitedRes) {
      expect(
        rateLimitedRes.headers()["retry-after"],
        "429 response must include Retry-After header"
      ).toBeDefined();
    } else {
      // Rate limit was not triggered in this run – skip rather than fail
      test.skip(true, "Rate limit not triggered within 20 requests");
    }
  });

  test("rate-limit error body does not leak internal threshold values", async ({ request }) => {
    const token = await getToken(request, "contributor");

    for (let i = 0; i < 20; i++) {
      const res = await testPost(
        request,
        "/api/contributor/appeals",
        { reason: `leak-check ${i}`, description: uuid(), attachments: [] },
        token
      );
      if (res.status() === 429) {
        const body = await res.json();
        const bodyStr = JSON.stringify(body).toLowerCase();
        // The response must NOT reveal internal rate-limit bucket sizes or scoring weights
        expect(bodyStr).not.toMatch(/\blimit\s*[:=]\s*\d+\b/i);
        expect(bodyStr).not.toMatch(/\bscore\b/i);
        expect(bodyStr).not.toMatch(/\bthreshold\b/i);
        break;
      }
    }
  });
});

test.describe("QA-204 | Duplicate action prevention", () => {
  test("duplicate appeal submission is rejected with 409", async ({ request }) => {
    const token = await getToken(request, "contributor");
    const payload = {
      reason: "Duplicate test",
      description: "This exact appeal should only be created once.",
      attachments: [],
      idempotencyKey: uuid(), // client-supplied dedup key
    };

    const first = await testPost(request, "/api/contributor/appeals", payload, token);
    expect(first.ok()).toBeTruthy();

    const second = await testPost(request, "/api/contributor/appeals", payload, token);
    expect(second.status()).toBe(409);

    const body = await second.json();
    expect(body).toHaveProperty("error");
    // Must reference the existing resource, not vague error
    expect(body.existingAppealId ?? body.error).toBeTruthy();
  });

  test("double-clicking stake action does not create two database records", async ({ request }) => {
    const token = await getToken(request, "contributor");
    const stakePayload = {
      projectId: "fixture-project-001",
      amount: 100,
      idempotencyKey: uuid(),
    };

    const [r1, r2] = await Promise.all([
      testPost(request, "/api/contributor/stakes", stakePayload, token),
      testPost(request, "/api/contributor/stakes", stakePayload, token),
    ]);

    const statuses = [r1.status(), r2.status()].sort();
    // Exactly one 2xx and one 409, or both 2xx with identical IDs
    if (r1.ok() && r2.ok()) {
      const b1 = await r1.json();
      const b2 = await r2.json();
      expect(b1.stakeId).toBe(b2.stakeId); // idempotent – same record
    } else {
      expect(statuses).toContain(409);
    }
  });

  test("re-submitting an already-approved verification is rejected", async ({ request }) => {
    const contribToken = await getToken(request, "contributor");
    const supportToken = await getToken(request, "support");

    const submission = await (
      await testPost(
        request,
        "/api/contributor/verification/submit",
        { documentType: "github_profile", documentUrl: `https://github.com/${uuid()}` },
        contribToken
      )
    ).json();

    // Approve via support
    await request.patch(`${API_BASE}/api/support/verification/${submission.submissionId}/approve`, {
      headers: { Authorization: `Bearer ${supportToken}` },
      data: { note: "Approved in duplicate-action test" },
    });

    // Contributor tries to submit again immediately
    const retry = await testPost(
      request,
      "/api/contributor/verification/submit",
      { documentType: "github_profile", documentUrl: `https://github.com/${uuid()}` },
      contribToken
    );
    // Should block resubmission while already approved (422) or accept as new review cycle (2xx)
    // Either is acceptable – what matters is it must NOT 500
    expect(retry.status()).not.toBe(500);
  });
});

test.describe("QA-204 | Suspicious retry pattern handling", () => {
  test("rapidly alternating appeals from same user do not corrupt state", async ({ request }) => {
    const token = await getToken(request, "contributor");

    // Submit two different appeals in rapid succession
    const [a1, a2] = await Promise.all([
      (
        await testPost(
          request,
          "/api/contributor/appeals",
          { reason: "First appeal", description: uuid(), attachments: [] },
          token
        )
      ).json(),
      (
        await testPost(
          request,
          "/api/contributor/appeals",
          { reason: "Second appeal", description: uuid(), attachments: [] },
          token
        )
      ).json(),
    ]);

    // Both must have distinct IDs or the second was correctly rate-limited
    if (a1.appealId && a2.appealId) {
      expect(a1.appealId).not.toBe(a2.appealId);
    }

    // Retrieve both to confirm state integrity
    for (const appeal of [a1, a2]) {
      if (!appeal.appealId) continue;
      const detail = await testGet(
        request,
        `/api/contributor/appeals/${appeal.appealId}`,
        token
      );
      expect(detail.status()).toBe(200);
    }
  });

  test("forged role header is ignored and RBAC is enforced server-side", async ({ request }) => {
    const contribToken = await getToken(request, "contributor");

    // Attempt to reach a support-only endpoint with a spoofed role header
    const res = await request.get(`${API_BASE}/api/support/verification/pending`, {
      headers: {
        Authorization: `Bearer ${contribToken}`,
        "X-Role-Override": "support", // should be ignored
      },
    });
    expect(res.status()).toBe(403);
  });

  test("requests with missing or malformed Authorization header return 401", async ({ request }) => {
    const endpoints = [
      "/api/contributor/appeals",
      "/api/support/verification/pending",
      "/api/maintainer/appeals",
    ];

    for (const path of endpoints) {
      const noAuth = await request.get(`${API_BASE}${path}`);
      expect(noAuth.status(), `Missing auth on ${path}`).toBe(401);

      const badAuth = await request.get(`${API_BASE}${path}`, {
        headers: { Authorization: "Bearer not-a-real-token" },
      });
      expect(badAuth.status(), `Bad token on ${path}`).toBe(401);
    }
  });
});

test.describe("QA-204 | Moderation-safe frontend output", () => {
  test("rejection reason shown to contributor does not include internal scoring details", async ({
    page,
    request,
  }) => {
    const contribToken = await getToken(request, "contributor");
    const supportToken = await getToken(request, "support");

    const submission = await (
      await request.post(`${API_BASE}/api/contributor/verification/submit`, {
        headers: { Authorization: `Bearer ${contribToken}` },
        data: { documentType: "github_profile", documentUrl: `https://github.com/${uuid()}` },
      })
    ).json();

    await request.patch(
      `${API_BASE}/api/support/verification/${submission.submissionId}/reject`,
      {
        headers: { Authorization: `Bearer ${supportToken}` },
        data: {
          reason: "Insufficient evidence",
          note: "Internal: fraud-score=0.87, bucket=high-risk", // internal note
        },
      }
    );

    // Log in as contributor and inspect the rejection message in the UI
    await page.goto("/login");
    await page.fill('[data-testid="email-input"]', process.env.CONTRIBUTOR_EMAIL ?? "contributor@example.com");
    await page.fill('[data-testid="password-input"]', process.env.CONTRIBUTOR_PASSWORD ?? "password");
    await page.click('[data-testid="login-submit"]');
    await page.waitForURL("**/dashboard**");

    await page.goto("/contributor/verification");
    const rejectionText = await page.locator('[data-testid="rejection-message"]').textContent();

    // Frontend must not expose internal note content
    expect(rejectionText).not.toMatch(/fraud/i);
    expect(rejectionText).not.toMatch(/score/i);
    expect(rejectionText).not.toMatch(/bucket/i);
    expect(rejectionText).not.toMatch(/high-risk/i);
    // It should display the curated public reason
    expect(rejectionText).toMatch(/insufficient evidence/i);
  });

  test("appeal list page does not render raw API error payloads to end users", async ({ page }) => {
    await page.goto("/login");
    await page.fill('[data-testid="email-input"]', process.env.CONTRIBUTOR_EMAIL ?? "contributor@example.com");
    await page.fill('[data-testid="password-input"]', process.env.CONTRIBUTOR_PASSWORD ?? "password");
    await page.click('[data-testid="login-submit"]');
    await page.waitForURL("**/dashboard**");

    await page.goto("/contributor/appeals");
    await page.waitForLoadState("networkidle");

    const bodyText = await page.locator("body").textContent();

    // Stack traces or raw API error keys must not be visible
    expect(bodyText).not.toMatch(/at Object\.<anonymous>/);
    expect(bodyText).not.toMatch(/\bstack\b.*\bError\b/s);
    expect(bodyText).not.toMatch(/"code":\s*"INTERNAL_/);
  });

  test("XSS payload in appeal reason is sanitised in the UI", async ({ page, request }) => {
    const contribToken = await getToken(request, "contributor");

    const xssPayload = '<script>window.__xss=1</script><img src=x onerror="window.__xss=2">';

    await request.post(`${API_BASE}/api/contributor/appeals`, {
      headers: { Authorization: `Bearer ${contribToken}` },
      data: { reason: xssPayload, description: "XSS regression test", attachments: [] },
    });

    // Log in as support and view the appeal
    await page.goto("/login");
    await page.fill('[data-testid="email-input"]', process.env.SUPPORT_EMAIL ?? "support@example.com");
    await page.fill('[data-testid="password-input"]', process.env.SUPPORT_PASSWORD ?? "password");
    await page.click('[data-testid="login-submit"]');
    await page.waitForURL("**/dashboard**");

    await page.goto("/support/appeals");
    await page.waitForLoadState("networkidle");

    // The injected script must not have executed
    const xssFlag = await page.evaluate(() => (window as unknown as Record<string, unknown>)["__xss"]);
    expect(xssFlag).toBeUndefined();
  });
});
