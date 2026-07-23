import { describe, it, expect, vi } from "vitest";

// Mock the SDK so we can drive Address / Contract with any string and
// avoid depending on a usable RNG for Keypair.random() in jsdom.
vi.mock("@stellar/stellar-sdk", async () => {
  const real = await vi.importActual<typeof import("@stellar/stellar-sdk")>(
    "@stellar/stellar-sdk",
  );
  return {
    ...real,
    StrKey: {
      ...real.StrKey,
      isValidEd25519PublicKey: () => true,
      isValidContract: () => true,
    },
    Address: vi.fn().mockImplementation((s: string) => ({
      toScVal: () => ({ __mockAddr: s }),
      toString: () => s,
    })),
    Contract: vi.fn().mockImplementation((id: string) => ({
      call: vi
        .fn()
        .mockImplementation(
          (method: string, ...args: unknown[]) => (
            mockOpFor(id, method, args)
          ),
        ),
    })),
    nativeToScVal: vi.fn().mockImplementation((v: unknown) => ({
      __mockScVal: v,
    })),
  };
});

import {
  buildSacCallOperation,
  isPositiveIntString,
  type SacAction,
} from "@/lib/sac-operations";

function mockOpFor(contractId: string, method: string, _args: unknown[]) {
  return {
    __mockOp: true,
    contractId,
    method,
    toXDR: () => `xdr:${contractId.slice(0, 8)}:${method}`,
  };
}

describe("isPositiveIntString", () => {
  it("accepts plain positive integers", () => {
    expect(isPositiveIntString("1")).toBe(true);
    expect(isPositiveIntString("42")).toBe(true);
    expect(isPositiveIntString("1000000000000")).toBe(true);
  });

  it("rejects zero, negatives, floats, and garbage", () => {
    expect(isPositiveIntString("0")).toBe(false);
    expect(isPositiveIntString("-1")).toBe(false);
    expect(isPositiveIntString("1.5")).toBe(false);
    expect(isPositiveIntString("abc")).toBe(false);
    expect(isPositiveIntString("")).toBe(false);
    expect(isPositiveIntString(" 100")).toBe(true); // trimmed before regex
  });
});

describe("buildSacCallOperation", () => {
  it.each<SacAction>(["transfer", "mint", "burn", "clawback"])(
    "constructs an op for %s",
    (action) => {
      const op = buildSacCallOperation({
        contractId: "C-mock",
        action,
        amount: "1000",
        recipient: "G-mock-recipient",
        from: "G-mock-admin",
      }) as { __mockOp?: boolean; toXDR: (fmt?: "base64") => string };
      expect(op.__mockOp).toBe(true);
      const xdr = op.toXDR();
      expect(xdr.length).toBeGreaterThan(0);
    },
  );

  it("throws when contractId is missing", () => {
    expect(() =>
      buildSacCallOperation({
        contractId: "",
        action: "transfer",
        amount: "1",
        from: "G-mock-admin",
        recipient: "G-mock-recipient",
      }),
    ).toThrow();
  });

  it("throws when amount is invalid", () => {
    expect(() =>
      buildSacCallOperation({
        contractId: "C-mock",
        action: "mint",
        amount: "-5",
        recipient: "G-mock-recipient",
      }),
    ).toThrow();
    expect(() =>
      buildSacCallOperation({
        contractId: "C-mock",
        action: "mint",
        amount: "0",
        recipient: "G-mock-recipient",
      }),
    ).toThrow();
  });

  it("throws when a required address is missing", () => {
    expect(() =>
      buildSacCallOperation({
        contractId: "C-mock",
        action: "transfer",
        amount: "1",
        from: "G-mock-admin",
      }),
    ).toThrow(/transfer requires a to/i);

    expect(() =>
      buildSacCallOperation({
        contractId: "C-mock",
        action: "mint",
        amount: "1",
      }),
    ).toThrow(/mint requires a to/i);

    expect(() =>
      buildSacCallOperation({
        contractId: "C-mock",
        action: "burn",
        amount: "1",
      }),
    ).toThrow(/burn requires a from/i);

    expect(() =>
      buildSacCallOperation({
        contractId: "C-mock",
        action: "clawback",
        amount: "1",
      }),
    ).toThrow(/clawback requires/);
  });
});
