/**
 * QA-202 / BE-207: Verification and eligibility gating tests.
 *
 * Ensures Wave-sensitive actions cannot bypass upfront verification checks.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { ForbiddenException } from "@nestjs/common";
import type { ExecutionContext } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import {
  REQUIRE_VERIFIED,
  VerificationGuard,
} from "./auth/verification.guard.js";
import { EligibilityService } from "./modules/wave/eligibility.service.js";

function createMockContext(options: {
  requireVerified?: boolean;
  headers?: Record<string, string | string[] | undefined>;
}): ExecutionContext {
  const req = { headers: options.headers ?? {} };
  return {
    switchToHttp: () => ({
      getRequest: () => req,
    }),
    getHandler: () => ({}),
    getClass: () => ({}),
  } as unknown as ExecutionContext;
}

function createGuard(requireVerified: boolean): VerificationGuard {
  const reflector = {
    getAllAndOverride: (key: string) =>
      key === REQUIRE_VERIFIED ? requireVerified : undefined,
  } as unknown as Reflector;
  return new VerificationGuard(reflector);
}

test("VerificationGuard: allows requests when verification is not required", () => {
  const guard = createGuard(false);
  const ctx = createMockContext({ requireVerified: false, headers: {} });
  assert.equal(guard.canActivate(ctx), true);
});

test("VerificationGuard: rejects missing x-verified-key on protected routes", () => {
  const guard = createGuard(true);
  const ctx = createMockContext({ requireVerified: true, headers: {} });

  assert.throws(
    () => guard.canActivate(ctx),
    (err: unknown) => {
      assert.ok(err instanceof ForbiddenException);
      assert.match(
        err.message,
        /requires a verified identity/i,
      );
      return true;
    },
  );
});

test("VerificationGuard: rejects short x-verified-key values", () => {
  const guard = createGuard(true);
  const ctx = createMockContext({
    requireVerified: true,
    headers: { "x-verified-key": "short" },
  });

  assert.throws(
    () => guard.canActivate(ctx),
    (err: unknown) => err instanceof ForbiddenException,
  );
});

test("VerificationGuard: accepts a valid x-verified-key and attaches it to the request", () => {
  const guard = createGuard(true);
  const ctx = createMockContext({
    requireVerified: true,
    headers: { "x-verified-key": "  verified-key-abc123  " },
  });
  const req = ctx.switchToHttp().getRequest<{ verifiedKey?: string }>();

  assert.equal(guard.canActivate(ctx), true);
  assert.equal(req.verifiedKey, "verified-key-abc123");
});

test("EligibilityService: denies claim, appeal, and reward without verified identity", () => {
  const service = new EligibilityService();
  const ownerKey = "owner-key-12345678";

  for (const action of ["claim", "appeal", "reward"] as const) {
    const result = service.check({ ownerKey, action });
    assert.equal(result.eligible, false);
    assert.match(result.reason ?? "", /verified identity required/i);
  }
});

test("EligibilityService: allows claim and appeal when verified identity is present", () => {
  const service = new EligibilityService();
  const ownerKey = "owner-key-12345678";

  for (const action of ["claim", "appeal"] as const) {
    const result = service.check({
      ownerKey,
      verifiedKey: ownerKey,
      action,
    });
    assert.equal(result.eligible, true);
  }
});

test("EligibilityService: reward requires verified key to match owner key", () => {
  const service = new EligibilityService();
  const ownerKey = "owner-key-12345678";

  const mismatch = service.check({
    ownerKey,
    verifiedKey: "different-verified-key",
    action: "reward",
  });
  assert.equal(mismatch.eligible, false);
  assert.match(mismatch.reason ?? "", /match the owner key/i);

  const match = service.check({
    ownerKey,
    verifiedKey: ownerKey,
    action: "reward",
  });
  assert.equal(match.eligible, true);
});

test("EligibilityService: assertEligible throws structured ForbiddenException", () => {
  const service = new EligibilityService();

  assert.throws(
    () =>
      service.assertEligible({
        ownerKey: "owner-key-12345678",
        action: "claim",
      }),
    (err: unknown) => {
      assert.ok(err instanceof ForbiddenException);
      const response = err.getResponse() as {
        code?: string;
        action?: string;
        reason?: string;
      };
      assert.equal(response.code, "ELIGIBILITY_DENIED");
      assert.equal(response.action, "claim");
      assert.match(response.reason ?? "", /verified identity required/i);
      return true;
    },
  );
});
