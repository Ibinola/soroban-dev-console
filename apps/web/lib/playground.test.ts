// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Keypair, nativeToScVal } from "@stellar/stellar-sdk";
import {
  PLAYGROUND_DEBOUNCE_MS,
  buildPlaygroundArgs,
  createDebounced,
  decodeReturnValue,
  simulatePlaygroundCall,
} from "./playground";

describe("createDebounced (#1290)", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("waits 500 ms after the last call and runs once with the latest arguments", () => {
    expect(PLAYGROUND_DEBOUNCE_MS).toBe(500);
    const fn = vi.fn();
    const d = createDebounced(fn, PLAYGROUND_DEBOUNCE_MS);
    d("a");
    vi.advanceTimersByTime(300);
    d("b");
    vi.advanceTimersByTime(499);
    expect(fn).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenCalledWith("b");
  });

  it("can be cancelled", () => {
    const fn = vi.fn();
    const d = createDebounced(fn, 500);
    d();
    d.cancel();
    vi.advanceTimersByTime(1000);
    expect(fn).not.toHaveBeenCalled();
  });
});

describe("buildPlaygroundArgs", () => {
  it("converts valid text inputs to ScVals", () => {
    const built = buildPlaygroundArgs(
      [
        { name: "n", type: "u32" },
        { name: "flag", type: "bool" },
      ],
      ["7", "true"],
    );
    expect(built.ok && built.args).toHaveLength(2);
  });

  it("reports the first missing value by name", () => {
    expect(buildPlaygroundArgs([{ name: "amount", type: "i128" }], [" "])).toEqual({
      ok: false,
      error: "Enter a value for “amount”.",
    });
  });

  it("reports values that cannot be converted", () => {
    const built = buildPlaygroundArgs([{ name: "items", type: "vec" }], ["not json"]);
    expect(built.ok).toBe(false);
    expect(!built.ok && built.error).toContain("items");
  });

  it("needs no values for a function without inputs", () => {
    expect(buildPlaygroundArgs([], [])).toEqual({ ok: true, args: [] });
  });
});

describe("simulatePlaygroundCall", () => {
  const contractId = "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC";
  const passphrase = "Test SDF Network ; September 2015";

  it("only simulates, and returns the decoded value with the resource cost", async () => {
    const simulateTransaction = vi.fn().mockResolvedValue({
      id: "1",
      latestLedger: 1,
      events: [],
      _parsed: true,
      transactionData: {},
      minResourceFee: "1234",
      cost: { cpuInsns: "5000", memBytes: "300" },
      result: { retval: nativeToScVal(42, { type: "u32" }), auth: [] },
    });
    const server = { simulateTransaction };
    const res = await simulatePlaygroundCall({
      server,
      networkPassphrase: passphrase,
      contractId,
      fnName: "get",
      args: [],
    });
    expect(simulateTransaction).toHaveBeenCalledTimes(1);
    expect(Object.keys(server)).toEqual(["simulateTransaction"]); // no way to submit
    expect(res.ok).toBe(true);
    expect(res.returnValue).toBe("42");
    expect(res.cost).toMatchObject({ minResourceFee: "1234", cpuInsns: 5000, memBytes: 300 });
  });

  it("surfaces simulation errors", async () => {
    const server = {
      simulateTransaction: vi.fn().mockResolvedValue({ id: "1", latestLedger: 1, error: "HostError: boom" }),
    };
    const res = await simulatePlaygroundCall({ server, networkPassphrase: passphrase, contractId, fnName: "x", args: [] });
    expect(res.ok).toBe(false);
    expect(res.error).toContain("boom");
  });

  it("turns thrown errors into a failed result", async () => {
    const server = { simulateTransaction: vi.fn().mockRejectedValue(new Error("network down")) };
    const res = await simulatePlaygroundCall({ server, networkPassphrase: passphrase, contractId, fnName: "x", args: [] });
    expect(res).toEqual({ ok: false, error: "network down" });
  });

  it("uses a throwaway source account, never a real signer", async () => {
    const server = { simulateTransaction: vi.fn().mockResolvedValue({ id: "1", latestLedger: 1, error: "e" }) };
    await simulatePlaygroundCall({ server, networkPassphrase: passphrase, contractId, fnName: "x", args: [] });
    const tx = server.simulateTransaction.mock.calls[0][0];
    expect(tx.source).toBe(Keypair.fromRawEd25519Seed(Buffer.alloc(32, 1)).publicKey());
    expect(tx.signatures).toHaveLength(0);
  });
});

describe("decodeReturnValue", () => {
  it("pretty-prints decoded values and tolerates garbage", () => {
    expect(decodeReturnValue(undefined)).toBeUndefined();
    expect(decodeReturnValue(nativeToScVal("hi", { type: "string" }).toXDR("base64"))).toBe('"hi"');
    expect(decodeReturnValue("not xdr")).toBe("not xdr");
  });
});
