import "reflect-metadata";
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { xdr } from "@stellar/stellar-sdk";
import { TransactionNormalizerService } from "./transaction-normalizer.service.js";

/**
 * Golden fixtures for RPC provider response variants (#1403).
 *
 * Each `fixtures/<name>.json` is a sanitized provider response (no credentials,
 * no account identifiers, only synthetic hashes) and `<name>.golden.json` is
 * the normalized output the normalizer must produce for it. A mismatch prints a
 * readable per-key diff. Regenerate the goldens after an intentional change with
 *   UPDATE_GOLDEN=1 npm run test:golden
 * and review the resulting diff in the PR.
 */
const FIXTURE_DIR = path.resolve(process.cwd(), "src/modules/rpc/fixtures");
const normalizer = new TransactionNormalizerService();

interface Fixture {
  variant: "send" | "get" | "simulate";
  description: string;
  response: Record<string, any>;
}

function run(fixture: Fixture): unknown {
  const response = structuredClone(fixture.response);
  switch (fixture.variant) {
    case "send":
      return normalizer.normalizeSendTransaction(response as never);
    case "get":
      return normalizer.normalizeGetTransaction(response as never);
    case "simulate": {
      // Provider JSON carries XDR as base64; the SDK object form carries XDR objects.
      if (response.result?.retvalXdr !== undefined) {
        response.result.retval = xdr.ScVal.fromXDR(response.result.retvalXdr, "base64");
        delete response.result.retvalXdr;
      }
      return normalizer.normalizeSimulation(response as never);
    }
  }
}

/** Readable, line-per-key difference between two JSON-able values. */
export function diffJson(expected: unknown, actual: unknown): string {
  const e = JSON.parse(JSON.stringify(expected)) as Record<string, unknown>;
  const a = JSON.parse(JSON.stringify(actual)) as Record<string, unknown>;
  const lines: string[] = [];
  for (const key of [...new Set([...Object.keys(e), ...Object.keys(a)])].sort()) {
    if (JSON.stringify(e[key]) !== JSON.stringify(a[key])) {
      lines.push(`  ${key}: expected ${JSON.stringify(e[key])} but got ${JSON.stringify(a[key])}`);
    }
  }
  return lines.join("\n");
}

const fixtureNames = readdirSync(FIXTURE_DIR)
  .filter((f) => f.endsWith(".json") && !f.endsWith(".golden.json"))
  .map((f) => f.replace(/\.json$/, ""))
  .sort();

describe("RPC provider response golden fixtures (#1403)", () => {
  it("covers every supported response variant", () => {
    const variants = new Set(fixtureNames.map((n) => JSON.parse(readFileSync(path.join(FIXTURE_DIR, `${n}.json`), "utf8")).variant));
    assert.deepEqual([...variants].sort(), ["get", "send", "simulate"]);
    for (const status of ["PENDING", "ERROR", "DUPLICATE", "TRY_AGAIN_LATER", "SUCCESS", "FAILED", "NOT_FOUND"]) {
      assert.ok(
        fixtureNames.some((n) => JSON.stringify(JSON.parse(readFileSync(path.join(FIXTURE_DIR, `${n}.json`), "utf8")).response.status) === `"${status}"`),
        `missing a fixture for status ${status}`,
      );
    }
    assert.ok(fixtureNames.some((n) => n === "simulate-error"));
    assert.ok(fixtureNames.some((n) => n === "simulate-partial"));
  });

  it("fixtures contain no credentials or account identifiers", () => {
    for (const name of fixtureNames) {
      const text = readFileSync(path.join(FIXTURE_DIR, `${name}.json`), "utf8");
      assert.ok(!/\b[GCS][A-Z2-7]{55}\b/.test(text), `${name} contains an address or secret key`);
      assert.ok(!/(api[_-]?key|secret|token|password|authorization|https?:\/\/)/i.test(text), `${name} contains credential-like text`);
    }
  });

  for (const name of fixtureNames) {
    it(`normalizes ${name}`, () => {
      const fixture = JSON.parse(readFileSync(path.join(FIXTURE_DIR, `${name}.json`), "utf8")) as Fixture;
      const actual = JSON.parse(JSON.stringify(run(fixture)));
      const goldenPath = path.join(FIXTURE_DIR, `${name}.golden.json`);
      if (process.env.UPDATE_GOLDEN === "1") {
        writeFileSync(goldenPath, `${JSON.stringify(actual, null, 2)}\n`);
        return;
      }
      assert.ok(existsSync(goldenPath), `missing golden file for ${name}; run UPDATE_GOLDEN=1 npm run test:golden`);
      const expected = JSON.parse(readFileSync(goldenPath, "utf8"));
      assert.deepEqual(actual, expected, `${name} differs from its golden:\n${diffJson(expected, actual)}`);
    });
  }
});
