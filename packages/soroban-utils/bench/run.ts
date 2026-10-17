/**
 * soroban-utils performance benchmarks.
 *
 *   npx tsx packages/soroban-utils/bench/run.ts                    compare with baseline, exit 1 on regression
 *   npx tsx packages/soroban-utils/bench/run.ts --update-baseline  rewrite bench/baseline.json
 *   npx tsx packages/soroban-utils/bench/run.ts --out results.json machine-readable report
 *
 * Costs are normalised against a fixed calibration workload so the baseline is
 * comparable across machines. BENCH_THRESHOLD overrides the 20% limit.
 */
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { nativeToScVal } from "@stellar/stellar-sdk";
import {
  decodeXdr,
  encodeJsonToXdr,
  extractWasmCustomSection,
  normalizeAbiJson,
  validateWasmBinary,
} from "../src/index";
import {
  DEFAULT_THRESHOLD,
  baselineFromReport,
  compareToBaseline,
  formatComparison,
  median,
  type Baseline,
  type BenchReport,
  type BenchResult,
} from "./compare";

const here = path.dirname(fileURLToPath(import.meta.url));
const BASELINE_PATH = path.join(here, "baseline.json");
const ROUNDS = 9;
const TARGET_ROUND_MS = 25;

// ── Fixtures ────────────────────────────────────────────────────────────────

const abi = {
  functions: Array.from({ length: 200 }, (_, i) => ({
    name: `fn_${i}`,
    doc: `Function number ${i}`,
    inputs: [
      { name: "from", type: "address" },
      { name: "to", type: "address" },
      { name: "amount", type: "i128" },
    ],
    outputs: [{ name: "ok", type: "bool" }],
  })),
};

const nativeValue = {
  id: 7,
  name: "benchmark",
  tags: ["a", "b", "c", "d"],
  nested: { a: 1, b: [1, 2, 3, 4, 5], c: { d: "deep", e: true } },
};
const scValXdr = nativeToScVal(nativeValue).toXDR("base64");
const valueJson = JSON.stringify(nativeValue);

function leb128(n: number): number[] {
  const out: number[] = [];
  do {
    let byte = n & 0x7f;
    n >>>= 7;
    if (n !== 0) byte |= 0x80;
    out.push(byte);
  } while (n !== 0);
  return out;
}

/** A structurally valid module: header plus many custom sections, the target last. */
function buildWasm(): Uint8Array {
  const bytes: number[] = [0x00, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00];
  const customSection = (name: string, payloadLength: number) => {
    const nameBytes = Array.from(name, (c) => c.charCodeAt(0));
    const body = [...leb128(nameBytes.length), ...nameBytes, ...new Array<number>(payloadLength).fill(7)];
    bytes.push(0, ...leb128(body.length), ...body);
  };
  for (let i = 0; i < 200; i++) customSection(`filler${i}`, 2048);
  customSection("contractmetav0", 64);
  return Uint8Array.from(bytes);
}
const wasm = buildWasm();

const CASES: Record<string, () => unknown> = {
  "spec-parse/normalizeAbiJson(200 fns)": () => normalizeAbiJson(abi),
  "xdr/encodeJsonToXdr(ScVal)": () => encodeJsonToXdr(valueJson, "ScVal"),
  "xdr/decodeXdr(ScVal)": () => decodeXdr(scValXdr),
  "wasm/validateWasmBinary": () => validateWasmBinary(wasm),
  "wasm/extractWasmCustomSection": () => extractWasmCustomSection(wasm, "contractmetav0"),
};

/** Fixed pure-JS workload used to normalise timings across machines. */
function calibrationWorkload(): number {
  let acc = 0;
  for (let i = 0; i < 20_000; i++) acc = (acc * 31 + i) % 1_000_003;
  return acc;
}

// ── Measurement ─────────────────────────────────────────────────────────────

function measure(fn: () => unknown): BenchResult & { medianMs: number } {
  // Warm up and pick an iteration count so each round takes ~TARGET_ROUND_MS.
  for (let i = 0; i < 5; i++) fn();
  let iterations = 1;
  for (;;) {
    const start = performance.now();
    for (let i = 0; i < iterations; i++) fn();
    if (performance.now() - start >= TARGET_ROUND_MS || iterations >= 1 << 20) break;
    iterations *= 2;
  }
  const samples: number[] = [];
  for (let r = 0; r < ROUNDS; r++) {
    const start = performance.now();
    for (let i = 0; i < iterations; i++) fn();
    samples.push((performance.now() - start) / iterations);
  }
  return { medianMs: median(samples), relative: 0, iterations };
}

export function runAll(): BenchReport {
  const calibration = measure(calibrationWorkload).medianMs;
  const results: Record<string, BenchResult> = {};
  for (const [name, fn] of Object.entries(CASES)) {
    const m = measure(fn);
    results[name] = { ...m, relative: m.medianMs / calibration };
  }
  return {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    node: process.version,
    calibrationMs: calibration,
    results,
  };
}

function main() {
  const args = process.argv.slice(2);
  const outIndex = args.indexOf("--out");
  const outPath = outIndex >= 0 ? args[outIndex + 1] : undefined;
  const threshold = Number(process.env.BENCH_THRESHOLD ?? DEFAULT_THRESHOLD);

  let report = runAll();
  if (outPath) writeFileSync(outPath, JSON.stringify(report, null, 2) + "\n");

  if (args.includes("--update-baseline")) {
    writeFileSync(BASELINE_PATH, JSON.stringify(baselineFromReport(report), null, 2) + "\n");
    console.log(`Baseline updated: ${path.relative(process.cwd(), BASELINE_PATH)}`);
    for (const [name, r] of Object.entries(report.results)) console.log(`  ${name}: ${r.relative.toPrecision(4)}x`);
    return;
  }

  const baseline = JSON.parse(readFileSync(BASELINE_PATH, "utf8")) as Baseline;
  let { comparisons, failed } = compareToBaseline(report, baseline, threshold);
  if (failed) {
    // Timing noise: re-measure once and only fail if the regression persists.
    console.log("Possible regression, re-measuring to rule out noise…");
    report = runAll();
    if (outPath) writeFileSync(outPath, JSON.stringify(report, null, 2) + "\n");
    ({ comparisons, failed } = compareToBaseline(report, baseline, threshold));
  }

  console.log(`soroban-utils benchmarks (threshold +${(threshold * 100).toFixed(0)}%)`);
  for (const c of comparisons) console.log("  " + formatComparison(c));
  if (failed) {
    console.error("\n❌ Performance regression detected. If intentional, run `npm run bench:update -w @devconsole/soroban-utils`.");
    process.exit(1);
  }
  console.log("\n✅ No performance regressions.");
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
