/**
 * Issue #1219: Contract spec parsing fuzz tests for malformed WASM inputs.
 *
 * Feeds randomly mutated WASM binaries to the spec parser and verifies it
 * either returns a valid spec or a structured error — never an unhandled throw.
 *
 * Constraints:
 * - At least 1000 mutated inputs per run
 * - 30 second wall-clock budget
 * - Seeded PRNG for reproducibility; failing seeds are logged
 */

import { describe, it, expect } from "vitest";
import {
  parseWasmClientSpec,
  extractWasmCustomSection,
  type WasmParsedSpec,
} from "@devconsole/soroban-utils";

/** Minimal valid WASM module (empty module: magic + version). */
const MINIMAL_WASM = new Uint8Array([
  0x00, 0x61, 0x73, 0x6d, // magic \0asm
  0x01, 0x00, 0x00, 0x00, // version 1
]);

function buildSpecSeed(): Uint8Array {
  const name = "contractspecv0";
  const payload = "init transfer balance";
  const nameBytes = new TextEncoder().encode(name);
  const payloadBytes = new TextEncoder().encode(payload);
  const nameLen = nameBytes.length;
  const bodyLen = 1 + nameBytes.length + payloadBytes.length;
  const out = new Uint8Array(8 + 1 + 1 + bodyLen);
  out.set(MINIMAL_WASM, 0);
  let o = 8;
  out[o++] = 0x00;
  out[o++] = bodyLen;
  out[o++] = nameLen;
  out.set(nameBytes, o);
  o += nameBytes.length;
  out.set(payloadBytes, o);
  return out;
}

function createRng(seed: number): () => number {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

type MutationKind =
  | "bitflip"
  | "byte_set"
  | "truncate"
  | "extend_garbage"
  | "insert_zeroes"
  | "overwrite_header"
  | "inflate_leb"
  | "random_slice";

function mutate(base: Uint8Array, rng: () => number): { bytes: Uint8Array; kind: MutationKind } {
  const kinds: MutationKind[] = [
    "bitflip",
    "byte_set",
    "truncate",
    "extend_garbage",
    "insert_zeroes",
    "overwrite_header",
    "inflate_leb",
    "random_slice",
  ];
  const kind = kinds[Math.floor(rng() * kinds.length)]!;
  const copy = new Uint8Array(base);

  switch (kind) {
    case "bitflip": {
      if (copy.length === 0) return { bytes: copy, kind };
      const idx = Math.floor(rng() * copy.length);
      const bit = 1 << Math.floor(rng() * 8);
      copy[idx] = (copy[idx] ?? 0) ^ bit;
      return { bytes: copy, kind };
    }
    case "byte_set": {
      if (copy.length === 0) return { bytes: copy, kind };
      const idx = Math.floor(rng() * copy.length);
      copy[idx] = Math.floor(rng() * 256);
      return { bytes: copy, kind };
    }
    case "truncate": {
      const keep = Math.floor(rng() * (copy.length + 1));
      return { bytes: copy.slice(0, keep), kind };
    }
    case "extend_garbage": {
      const extra = Math.floor(rng() * 64) + 1;
      const extended = new Uint8Array(copy.length + extra);
      extended.set(copy);
      for (let i = 0; i < extra; i++) {
        extended[copy.length + i] = Math.floor(rng() * 256);
      }
      return { bytes: extended, kind };
    }
    case "insert_zeroes": {
      const zeros = new Uint8Array(copy.length + Math.floor(rng() * 32));
      zeros.set(copy.subarray(0, Math.min(copy.length, zeros.length)));
      return { bytes: zeros, kind };
    }
    case "overwrite_header": {
      if (copy.length >= 4) {
        copy[0] = Math.floor(rng() * 256);
        copy[1] = Math.floor(rng() * 256);
      }
      return { bytes: copy, kind };
    }
    case "inflate_leb": {
      const prefix = copy.slice(0, Math.min(copy.length, 8 + Math.floor(rng() * 4)));
      const leb = new Uint8Array(prefix.length + 8);
      leb.set(prefix);
      for (let i = 0; i < 8; i++) {
        leb[prefix.length + i] = 0x80 | Math.floor(rng() * 0x7f);
      }
      return { bytes: leb, kind };
    }
    case "random_slice": {
      if (copy.length < 2) return { bytes: copy, kind };
      const start = Math.floor(rng() * copy.length);
      const end = start + Math.floor(rng() * (copy.length - start));
      return { bytes: copy.slice(start, end), kind };
    }
    default:
      return { bytes: copy, kind };
  }
}

function isStructuredResult(result: unknown): result is WasmParsedSpec {
  if (!result || typeof result !== "object") return false;
  const r = result as Record<string, unknown>;
  return (
    typeof r.valid === "boolean" &&
    typeof r.sizeBytes === "number" &&
    typeof r.formattedSize === "string" &&
    Array.isArray(r.functions) &&
    Array.isArray(r.parsedFunctions) &&
    Array.isArray(r.specFunctions) &&
    typeof r.hasConstructor === "boolean" &&
    (r.error === undefined || typeof r.error === "string")
  );
}

const DEFAULT_SEED = 0xc0ffee42;
const MIN_MUTATIONS = 1000;
const TIME_BUDGET_MS = 30_000;

describe("WASM spec parser fuzz suite (Issue #1219)", () => {
  it(
    "survives ≥1000 mutated WASM inputs without unhandled exceptions",
    async () => {
      const seedEnv = process.env.WASM_FUZZ_SEED;
      const seed = seedEnv ? Number.parseInt(seedEnv, 10) || DEFAULT_SEED : DEFAULT_SEED;
      const rng = createRng(seed);

      const seeds = [MINIMAL_WASM, buildSpecSeed()];
      const failingSeeds: Array<{
        seed: number;
        mutationIndex: number;
        kind: MutationKind;
        error: string;
      }> = [];

      const started = Date.now();
      let mutations = 0;
      let structuredOk = 0;
      let structuredErr = 0;

      while (mutations < MIN_MUTATIONS && Date.now() - started < TIME_BUDGET_MS) {
        const base = seeds[Math.floor(rng() * seeds.length)]!;
        let current = base;
        let kind: MutationKind = "bitflip";
        const stack = 1 + Math.floor(rng() * 3);
        for (let s = 0; s < stack; s++) {
          const m = mutate(current, rng);
          current = m.bytes;
          kind = m.kind;
        }

        const mutationIndex = mutations;
        mutations += 1;

        try {
          const result = await parseWasmClientSpec(current);
          if (!isStructuredResult(result)) {
            failingSeeds.push({
              seed,
              mutationIndex,
              kind,
              error: "Result is not a structured WasmParsedSpec object",
            });
            continue;
          }
          if (result.valid) {
            structuredOk += 1;
          } else {
            structuredErr += 1;
            if (!result.error || result.error.trim().length === 0) {
              failingSeeds.push({
                seed,
                mutationIndex,
                kind,
                error: "Invalid result missing descriptive error message",
              });
            }
          }

          extractWasmCustomSection(current, "contractspecv0");
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : String(err);
          failingSeeds.push({
            seed,
            mutationIndex,
            kind,
            error: `Unhandled exception: ${message}`,
          });
        }
      }

      const elapsed = Date.now() - started;

      // eslint-disable-next-line no-console
      console.log(
        JSON.stringify(
          {
            issue: 1219,
            seed,
            mutations,
            structuredOk,
            structuredErr,
            failures: failingSeeds.length,
            elapsedMs: elapsed,
            failingSeeds: failingSeeds.slice(0, 20),
          },
          null,
          2,
        ),
      );

      expect(mutations).toBeGreaterThanOrEqual(MIN_MUTATIONS);
      expect(elapsed).toBeLessThanOrEqual(TIME_BUDGET_MS + 2_000);

      if (failingSeeds.length > 0) {
        // eslint-disable-next-line no-console
        console.error(
          "Failing mutation seeds (reproduce with WASM_FUZZ_SEED):",
          failingSeeds.slice(0, 10),
        );
      }
      expect(failingSeeds).toEqual([]);
    },
    TIME_BUDGET_MS + 5_000,
  );

  it("returns structured errors for empty / truncated / garbage inputs", async () => {
    const cases: Uint8Array[] = [
      new Uint8Array(0),
      new Uint8Array([0x00]),
      new Uint8Array([0x00, 0x61, 0x73]),
      new Uint8Array([0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff]),
      new Uint8Array(Array.from({ length: 16 }, (_, i) => i * 17)),
    ];

    for (const input of cases) {
      let threw = false;
      let result: WasmParsedSpec | undefined;
      try {
        result = await parseWasmClientSpec(input);
      } catch {
        threw = true;
      }
      expect(threw).toBe(false);
      expect(result).toBeDefined();
      expect(isStructuredResult(result)).toBe(true);
      if (result && !result.valid) {
        expect(result.error).toBeTruthy();
        expect(typeof result.error).toBe("string");
      }
    }
  });
});
