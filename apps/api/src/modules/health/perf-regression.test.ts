import fs from "fs";
import path from "path";

const BASE_URL = process.env.BASE_URL ?? "http://localhost:3001";
const PERF_REPORT_DIR = process.env.PERF_REPORT_DIR ?? "./perf-reports";
const AUTH_TOKEN = process.env.PERF_TEST_TOKEN ?? "perf-test-token-change-me";

/** Thresholds in milliseconds. Adjust after establishing a real baseline. */
const THRESHOLDS = {
  budgetDashboard: {
    p50: 300,
    p95: 800,
    p99: 1_500,
  },
  triageQueue: {
    p50: 350,
    p95: 900,
    p99: 1_800,
  },
  appealList: {
    p50: 300,
    p95: 750,
    p99: 1_400,
  },
  transactionSearch: {
    p50: 400,
    p95: 1_000,
    p99: 2_000,
  },
} as const;

/** How many samples to collect per endpoint. More = tighter percentiles. */
const SAMPLES = parseInt(process.env.PERF_SAMPLES ?? "20", 10);

interface TimingResult {
  endpoint: string;
  samples: number[];
  p50: number;
  p95: number;
  p99: number;
  min: number;
  max: number;
}

function percentile(sorted: number[], p: number): number {
  const idx = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, idx)];
}

async function measureEndpoint(
  url: string,
  options: RequestInit = {},
  samples = SAMPLES
): Promise<TimingResult> {
  const timings: number[] = [];
  const defaultHeaders = {
    Authorization: `Bearer ${AUTH_TOKEN}`,
    "Content-Type": "application/json",
  };

  for (let i = 0; i < samples; i++) {
    const start = performance.now();
    const res = await fetch(url, {
      ...options,
      headers: { ...defaultHeaders, ...(options.headers ?? {}) },
    });
    const elapsed = performance.now() - start;

    if (!res.ok) {
      throw new Error(
        `Performance test request failed: ${res.status} ${res.statusText} — ${url}`
      );
    }

    timings.push(elapsed);

    // Small jitter between requests to avoid overwhelming a single goroutine
    await new Promise((r) => setTimeout(r, 10 + Math.random() * 20));
  }

  const sorted = [...timings].sort((a, b) => a - b);
  return {
    endpoint: url,
    samples: sorted,
    p50: percentile(sorted, 50),
    p95: percentile(sorted, 95),
    p99: percentile(sorted, 99),
    min: sorted[0],
    max: sorted[sorted.length - 1],
  };
}

function saveReport(name: string, result: TimingResult): void {
  if (!fs.existsSync(PERF_REPORT_DIR)) {
    fs.mkdirSync(PERF_REPORT_DIR, { recursive: true });
  }
  const filePath = path.join(
    PERF_REPORT_DIR,
    `${name}-${new Date().toISOString().replace(/[:.]/g, "-")}.json`
  );
  fs.writeFileSync(
    filePath,
    JSON.stringify({ name, timestamp: new Date().toISOString(), ...result }, null, 2)
  );
}

function assertThresholds(
  result: TimingResult,
  thresholds: { p50: number; p95: number; p99: number },
  label: string
): void {
  const failures: string[] = [];

  if (result.p50 > thresholds.p50) {
    failures.push(
      `p50 ${result.p50.toFixed(1)}ms > threshold ${thresholds.p50}ms`
    );
  }
  if (result.p95 > thresholds.p95) {
    failures.push(
      `p95 ${result.p95.toFixed(1)}ms > threshold ${thresholds.p95}ms`
    );
  }
  if (result.p99 > thresholds.p99) {
    failures.push(
      `p99 ${result.p99.toFixed(1)}ms > threshold ${thresholds.p99}ms`
    );
  }

  if (failures.length > 0) {
    throw new Error(
      `[${label}] Performance regression detected:\n  ${failures.join("\n  ")}`
    );
  }
}

// These IDs are created by scripts/seed-perf.ts at the volume defined there.
const PERF_BUDGET_ID = process.env.PERF_BUDGET_ID ?? "budget-perf-001";
const PERF_MAINTAINER_ID =
  process.env.PERF_MAINTAINER_ID ?? "maintainer-perf-001";

describe("QA-209 | Performance: budget dashboard", () => {
  let result: TimingResult;

  beforeAll(async () => {
    result = await measureEndpoint(
      `${BASE_URL}/api/budgets/${PERF_BUDGET_ID}/dashboard`
    );
    saveReport("budget-dashboard", result);
  }, 120_000);

  it(`p50 is within ${THRESHOLDS.budgetDashboard.p50}ms`, () => {
    expect(result.p50).toBeLessThanOrEqual(THRESHOLDS.budgetDashboard.p50);
  });

  it(`p95 is within ${THRESHOLDS.budgetDashboard.p95}ms`, () => {
    expect(result.p95).toBeLessThanOrEqual(THRESHOLDS.budgetDashboard.p95);
  });

  it(`p99 is within ${THRESHOLDS.budgetDashboard.p99}ms`, () => {
    expect(result.p99).toBeLessThanOrEqual(THRESHOLDS.budgetDashboard.p99);
  });

  it("prints a summary (diagnostic — always passes)", () => {
    console.info(
      `[budget-dashboard] p50=${result.p50.toFixed(1)}ms ` +
        `p95=${result.p95.toFixed(1)}ms ` +
        `p99=${result.p99.toFixed(1)}ms ` +
        `min=${result.min.toFixed(1)}ms ` +
        `max=${result.max.toFixed(1)}ms`
    );
  });
});

describe("QA-209 | Performance: triage queue", () => {
  let result: TimingResult;

  beforeAll(async () => {
    result = await measureEndpoint(
      `${BASE_URL}/api/reviews/queue?maintainer=${PERF_MAINTAINER_ID}&status=pending`
    );
    saveReport("triage-queue", result);
  }, 120_000);

  it(`p50 is within ${THRESHOLDS.triageQueue.p50}ms`, () => {
    expect(result.p50).toBeLessThanOrEqual(THRESHOLDS.triageQueue.p50);
  });

  it(`p95 is within ${THRESHOLDS.triageQueue.p95}ms`, () => {
    expect(result.p95).toBeLessThanOrEqual(THRESHOLDS.triageQueue.p95);
  });

  it(`p99 is within ${THRESHOLDS.triageQueue.p99}ms`, () => {
    expect(result.p99).toBeLessThanOrEqual(THRESHOLDS.triageQueue.p99);
  });
});

describe("QA-209 | Performance: appeal list", () => {
  let result: TimingResult;

  beforeAll(async () => {
    result = await measureEndpoint(
      `${BASE_URL}/api/appeals?budget=${PERF_BUDGET_ID}&page=1&pageSize=50`
    );
    saveReport("appeal-list", result);
  }, 120_000);

  it(`p50 is within ${THRESHOLDS.appealList.p50}ms`, () => {
    expect(result.p50).toBeLessThanOrEqual(THRESHOLDS.appealList.p50);
  });

  it(`p95 is within ${THRESHOLDS.appealList.p95}ms`, () => {
    expect(result.p95).toBeLessThanOrEqual(THRESHOLDS.appealList.p95);
  });

  it(`p99 is within ${THRESHOLDS.appealList.p99}ms`, () => {
    expect(result.p99).toBeLessThanOrEqual(THRESHOLDS.appealList.p99);
  });
});

describe("QA-209 | Performance: transaction search under high volume", () => {
  let result: TimingResult;

  beforeAll(async () => {
    result = await measureEndpoint(
      `${BASE_URL}/api/transactions?budgetId=${PERF_BUDGET_ID}&status=flagged&pageSize=100`
    );
    saveReport("transaction-search", result);
  }, 120_000);

  it(`p50 is within ${THRESHOLDS.transactionSearch.p50}ms`, () => {
    expect(result.p50).toBeLessThanOrEqual(THRESHOLDS.transactionSearch.p50);
  });

  it(`p95 is within ${THRESHOLDS.transactionSearch.p95}ms`, () => {
    expect(result.p95).toBeLessThanOrEqual(THRESHOLDS.transactionSearch.p95);
  });

  it(`p99 is within ${THRESHOLDS.transactionSearch.p99}ms`, () => {
    expect(result.p99).toBeLessThanOrEqual(THRESHOLDS.transactionSearch.p99);
  });
});

describe("QA-209 | Performance: concurrent request behaviour", () => {
  it("handles 10 concurrent dashboard requests without a 5xx response", async () => {
    const requests = Array.from({ length: 10 }, () =>
      fetch(`${BASE_URL}/api/budgets/${PERF_BUDGET_ID}/dashboard`, {
        headers: { Authorization: `Bearer ${AUTH_TOKEN}` },
      })
    );
    const responses = await Promise.all(requests);
    for (const res of responses) {
      expect(res.status).toBeLessThan(500);
    }
  }, 30_000);

  it("completes all 10 concurrent requests within the p99 threshold", async () => {
    const start = performance.now();
    const requests = Array.from({ length: 10 }, () =>
      fetch(`${BASE_URL}/api/budgets/${PERF_BUDGET_ID}/dashboard`, {
        headers: { Authorization: `Bearer ${AUTH_TOKEN}` },
      })
    );
    await Promise.all(requests);
    const elapsed = performance.now() - start;

    // All 10 concurrent requests should finish within 2× the single-request p99
    const budget = THRESHOLDS.budgetDashboard.p99 * 2;
    expect(elapsed).toBeLessThanOrEqual(budget);
  }, 30_000);
});
