import { describe, expect, it } from "vitest";
import { buildCallPermalink, parseCallPermalink, MAX_SHARED_RESULT_CHARS } from "./call-permalink";

const base = { contractId: "CABC", network: "testnet", fnName: "transfer" };

describe("call permalinks", () => {
  it("round-trips method, args and result", () => {
    const link = buildCallPermalink("https://console.example", {
      ...base,
      args: ["GFROM", "GTO", "10000000"],
      result: '{"ok":true}',
    });
    const url = new URL(link);
    expect(url.pathname).toBe("/contracts/CABC");
    expect(url.searchParams.get("network")).toBe("testnet");
    expect(parseCallPermalink(url.searchParams)).toEqual({
      fnName: "transfer",
      args: ["GFROM", "GTO", "10000000"],
      result: '{"ok":true}',
    });
  });

  it("handles non-ASCII values", () => {
    const link = buildCallPermalink("https://x.test", { ...base, args: ["héllo ✓"], result: "✓ done" });
    const parsed = parseCallPermalink(new URL(link).searchParams);
    expect(parsed.args).toEqual(["héllo ✓"]);
    expect(parsed.result).toBe("✓ done");
  });

  it("omits args and result when absent", () => {
    const url = new URL(buildCallPermalink("https://x.test", { ...base, args: [] }));
    expect(url.searchParams.has("args")).toBe(false);
    expect(url.searchParams.has("result")).toBe(false);
  });

  it("truncates oversized results", () => {
    const link = buildCallPermalink("https://x.test", {
      ...base,
      args: [],
      result: "x".repeat(MAX_SHARED_RESULT_CHARS + 500),
    });
    expect(parseCallPermalink(new URL(link).searchParams).result).toHaveLength(MAX_SHARED_RESULT_CHARS);
  });

  it("drops malformed or wrongly-typed args instead of throwing", () => {
    expect(parseCallPermalink(new URLSearchParams("args=%%%"))).toEqual({ fnName: null, args: null, result: null });
    const numbers = btoa(JSON.stringify([1, 2])).replace(/=+$/, "");
    expect(parseCallPermalink(new URLSearchParams(`args=${numbers}`)).args).toBeNull();
  });
});
