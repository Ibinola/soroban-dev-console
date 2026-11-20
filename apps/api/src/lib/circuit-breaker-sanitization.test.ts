import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { sanitizeCircuitSnapshots } from "./circuit-breaker.js";

describe("circuit breaker sanitization", () => {
  it("removes endpoints and credentials from snapshots", () => {
    const [entry] = sanitizeCircuitSnapshots([
      {
        endpoint: "https://user:token@rpc.example.com/secret-path",
        state: "open",
        consecutiveFailures: 5,
        retryInMs: 12_000,
      },
    ]);

    assert.ok(entry);
    assert.equal(entry.state, "open");
    assert.equal(entry.consecutiveFailures, 5);
    assert.equal(entry.retryInMs, 12_000);
    assert.match(entry.provider, /^provider-[0-9a-f]{8}$/);
    assert.equal(entry.provider.includes("rpc.example.com"), false);
    assert.equal(JSON.stringify(entry).includes("token"), false);
  });

  it("keeps provider identifiers stable for the same endpoint", () => {
    const snapshot = {
      endpoint: "https://rpc.example.com/mainnet",
      state: "closed" as const,
      consecutiveFailures: 0,
      retryInMs: 0,
    };

    assert.equal(
      sanitizeCircuitSnapshots([snapshot])[0]?.provider,
      sanitizeCircuitSnapshots([snapshot])[0]?.provider,
    );
  });
});
