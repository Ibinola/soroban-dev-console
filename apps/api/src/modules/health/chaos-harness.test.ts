import { jest } from "@jest/globals";

type FaultMode = "flaky" | "timeout" | "hard-down" | "slow";

interface FaultOptions {
  mode: FaultMode;
  /** for "flaky": fail on the first N calls, then succeed */
  failCount?: number;
  /** for "timeout" / "slow": ms to delay */
  delayMs?: number;
}

function makeFault<T>(
  successValue: T,
  opts: FaultOptions
): jest.MockedFunction<() => Promise<T>> {
  let callCount = 0;
  return jest.fn(async () => {
    callCount += 1;
    switch (opts.mode) {
      case "flaky": {
        const threshold = opts.failCount ?? 2;
        if (callCount <= threshold) throw new Error("transient network error");
        return successValue;
      }
      case "timeout":
        await new Promise((_, reject) =>
          setTimeout(
            () => reject(new Error("request timeout")),
            opts.delayMs ?? 5_000
          )
        );
        return successValue; // unreachable
      case "hard-down":
        throw new Error("service unavailable");
      case "slow":
        await new Promise((r) => setTimeout(r, opts.delayMs ?? 2_000));
        return successValue;
    }
  }) as jest.MockedFunction<() => Promise<T>>;
}

interface VerificationResult {
  status: "verified" | "failed" | "pending";
  transactionId: string;
}
interface NotificationResult {
  delivered: boolean;
  notificationId: string;
}
interface AppealResult {
  appealId: string;
  accepted: boolean;
}

/** Wraps a dependency call with linear retry + jitter. */
async function withRetry<T>(
  fn: () => Promise<T>,
  maxAttempts = 3,
  baseDelayMs = 50
): Promise<T> {
  let lastErr: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (attempt < maxAttempts) {
        const jitter = Math.random() * 20;
        await new Promise((r) =>
          setTimeout(r, baseDelayMs * attempt + jitter)
        );
      }
    }
  }
  throw lastErr;
}

/** Tries primary; falls over to secondary on any error. */
async function withFailover<T>(
  primary: () => Promise<T>,
  secondary: () => Promise<T>
): Promise<T> {
  try {
    return await primary();
  } catch {
    return secondary();
  }
}

/** Returns cached/default value when a non-critical dep is unavailable. */
async function withGracefulDegradation<T>(
  fn: () => Promise<T>,
  fallback: T
): Promise<T> {
  try {
    return await fn();
  } catch {
    return fallback;
  }
}

describe("QA-208 | Chaos: verification dependency", () => {
  it("retries a flaky verification call and eventually succeeds", async () => {
    const verifyTx = makeFault<VerificationResult>(
      { status: "verified", transactionId: "tx-001" },
      { mode: "flaky", failCount: 2 }
    );

    const result = await withRetry(() => verifyTx(), 3);

    expect(result.status).toBe("verified");
    expect(verifyTx).toHaveBeenCalledTimes(3); // 2 failures + 1 success
  });

  it("surfaces error after exhausting all retry attempts", async () => {
    const verifyTx = makeFault<VerificationResult>(
      { status: "verified", transactionId: "tx-002" },
      { mode: "hard-down" }
    );

    await expect(withRetry(() => verifyTx(), 3)).rejects.toThrow(
      "service unavailable"
    );
    expect(verifyTx).toHaveBeenCalledTimes(3);
  });

  it("fails over to secondary verifier when primary is down", async () => {
    const primaryVerify = makeFault<VerificationResult>(
      { status: "verified", transactionId: "tx-003" },
      { mode: "hard-down" }
    );
    const secondaryVerify = jest.fn(async (): Promise<VerificationResult> => ({
      status: "verified",
      transactionId: "tx-003",
    }));

    const result = await withFailover(
      () => primaryVerify(),
      () => secondaryVerify()
    );

    expect(result.status).toBe("verified");
    expect(primaryVerify).toHaveBeenCalledTimes(1);
    expect(secondaryVerify).toHaveBeenCalledTimes(1);
  });
});

describe("QA-208 | Chaos: notification dependency", () => {
  it("retries a flaky notification delivery and marks as delivered", async () => {
    const sendNotification = makeFault<NotificationResult>(
      { delivered: true, notificationId: "notif-001" },
      { mode: "flaky", failCount: 1 }
    );

    const result = await withRetry(() => sendNotification(), 3);

    expect(result.delivered).toBe(true);
    expect(sendNotification).toHaveBeenCalledTimes(2);
  });

  it("degrades gracefully when notification service is fully down", async () => {
    const sendNotification = makeFault<NotificationResult>(
      { delivered: true, notificationId: "notif-002" },
      { mode: "hard-down" }
    );

    const fallback: NotificationResult = {
      delivered: false,
      notificationId: "notif-002",
    };

    const result = await withGracefulDegradation(
      () => sendNotification(),
      fallback
    );

    // System stays up; delivery is queued for retry later
    expect(result.delivered).toBe(false);
    expect(result.notificationId).toBe("notif-002");
  });

  it("does not retry non-retryable notification errors more than once", async () => {
    // Simulate an error that should not be retried (e.g. 400 Bad Request)
    const sendNotification = jest.fn(async (): Promise<NotificationResult> => {
      const err: Error & { retryable?: boolean } = new Error("bad request");
      err.retryable = false;
      throw err;
    });

    const smartRetry = async (fn: () => Promise<NotificationResult>) => {
      try {
        return await fn();
      } catch (err: unknown) {
        const e = err as Error & { retryable?: boolean };
        if (e.retryable === false) throw err;
        return withRetry(fn, 3);
      }
    };

    await expect(smartRetry(sendNotification)).rejects.toThrow("bad request");
    expect(sendNotification).toHaveBeenCalledTimes(1);
  });
});

describe("QA-208 | Chaos: appeal dependency", () => {
  it("retries a flaky appeal submission up to the configured limit", async () => {
    const submitAppeal = makeFault<AppealResult>(
      { appealId: "appeal-001", accepted: true },
      { mode: "flaky", failCount: 2 }
    );

    const result = await withRetry(() => submitAppeal(), 4);

    expect(result.accepted).toBe(true);
    expect(submitAppeal).toHaveBeenCalledTimes(3);
  });

  it("fails over to async-queue path when synchronous appeal endpoint is down", async () => {
    const syncAppeal = makeFault<AppealResult>(
      { appealId: "appeal-002", accepted: true },
      { mode: "hard-down" }
    );

    // Simulates enqueuing the appeal for later processing
    const asyncQueueAppeal = jest.fn(
      async (): Promise<AppealResult & { queued: boolean }> => ({
        appealId: "appeal-002",
        accepted: false,
        queued: true,
      })
    );

    const result = await withFailover(
      () => syncAppeal(),
      () => asyncQueueAppeal()
    );

    expect((result as AppealResult & { queued?: boolean }).queued).toBe(true);
    expect(asyncQueueAppeal).toHaveBeenCalledTimes(1);
  });
});

describe("QA-208 | Chaos: combined degraded-service scenario", () => {
  it("returns a partial response when only the notification dep is down", async () => {
    // Verification succeeds; notification is down
    const verifyTx = jest.fn(
      async (): Promise<VerificationResult> => ({
        status: "verified",
        transactionId: "tx-010",
      })
    );
    const sendNotification = makeFault<NotificationResult>(
      { delivered: true, notificationId: "notif-010" },
      { mode: "hard-down" }
    );

    const [verification, notification] = await Promise.all([
      verifyTx(),
      withGracefulDegradation(() => sendNotification(), {
        delivered: false,
        notificationId: "notif-010",
      }),
    ]);

    expect(verification.status).toBe("verified");
    expect(notification.delivered).toBe(false); // degraded, not crashed
  });
});
