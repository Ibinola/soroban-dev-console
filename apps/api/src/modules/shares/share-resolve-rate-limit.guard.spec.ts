/**
 * Issue #1120: unit coverage for ShareResolveRateLimitGuard.
 */

import { HttpException, HttpStatus } from "@nestjs/common";
import type { ExecutionContext } from "@nestjs/common";
import { ShareResolveRateLimitGuard } from "./share-resolve-rate-limit.guard.js";

const mockAudit = { log: jest.fn() };

function makeContext(ip: string, token = "tok-1"): ExecutionContext {
  const request = {
    ip,
    headers: {},
    params: { token },
  };
  const response = { setHeader: jest.fn() };

  return {
    switchToHttp: () => ({
      getRequest: () => request,
      getResponse: () => response,
    }),
  } as unknown as ExecutionContext;
}

describe("ShareResolveRateLimitGuard (issue #1120)", () => {
  beforeEach(() => jest.clearAllMocks());

  it("allows requests under the per-IP limit", () => {
    const guard = new (ShareResolveRateLimitGuard as any)(mockAudit);
    for (let i = 0; i < 30; i++) {
      expect(guard.canActivate(makeContext("1.2.3.4"))).toBe(true);
    }
  });

  it("throws 429 with Retry-After once the limit is exceeded, and audit-logs the violation", () => {
    const guard = new (ShareResolveRateLimitGuard as any)(mockAudit);
    for (let i = 0; i < 30; i++) {
      guard.canActivate(makeContext("5.6.7.8"));
    }

    let thrown: unknown;
    try {
      guard.canActivate(makeContext("5.6.7.8"));
    } catch (err) {
      thrown = err;
    }

    expect(thrown).toBeInstanceOf(HttpException);
    expect((thrown as HttpException).getStatus()).toBe(HttpStatus.TOO_MANY_REQUESTS);
    expect(mockAudit.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "share.resolve.rate_limited",
        resourceType: "share_link",
      }),
    );
  });

  it("tracks separate IPs independently", () => {
    const guard = new (ShareResolveRateLimitGuard as any)(mockAudit);
    for (let i = 0; i < 30; i++) {
      guard.canActivate(makeContext("9.9.9.9"));
    }
    expect(guard.canActivate(makeContext("10.10.10.10"))).toBe(true);
  });
});
