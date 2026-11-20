import { describe, it, expect } from "vitest";
import {
  getSignatureTimeoutMs,
  SignatureTimeoutError,
  withSignatureTimeout,
} from "./signature-timeout";

describe("signature timeout adapter", () => {
  it("keeps fast responses", async () => {
    await expect(withSignatureTimeout(Promise.resolve("signed"), { timeoutMs: 1_000 })).resolves.toBe("signed");
  });

  it("rejects stalled signature requests with a retryable error", async () => {
    const pending = new Promise<string>(() => {});
    await expect(withSignatureTimeout(pending, { timeoutMs: 1_000, provider: "freighter" })).rejects.toMatchObject({
      name: "SignatureTimeoutError",
      provider: "freighter",
      retryable: true,
    });
  });

  it("ignores responses that arrive after the timeout", async () => {
    let settle!: (value: string) => void;
    const pending = new Promise<string>((resolve) => {
      settle = resolve;
    });
    const result = withSignatureTimeout(pending, { timeoutMs: 1_000 });
    await expect(result).rejects.toBeInstanceOf(SignatureTimeoutError);
    settle("late");
    await new Promise((resolve) => setTimeout(resolve, 0));
  });

  it("clamps configured durations", () => {
    expect(getSignatureTimeoutMs(0)).toBe(1_000);
    expect(getSignatureTimeoutMs(999_999)).toBe(300_000);
  });
});
