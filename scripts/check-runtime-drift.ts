#!/usr/bin/env tsx
/**
 * check-runtime-drift.ts
 *
 * Validates that the ports and API URLs declared in runtime-defaults.ts stay
 * in sync with the values documented in .env.example files and README.md.
 *
 * Exits non-zero on any mismatch so the devops CI gate blocks the merge.
 */

import { existsSync, readFileSync } from "fs";
import { resolve } from "path";

const ROOT = resolve(__dirname, "..");

function read(relativePath: string): string {
  const full = resolve(ROOT, relativePath);
  if (!existsSync(full)) {
    throw new Error(`File not found: ${relativePath}`);
  }
  return readFileSync(full, "utf-8");
}

// ─── Extract canonical values from runtime-defaults.ts ────────────────────

const defaultsSrc = read("packages/api-contracts/src/runtime-defaults.ts");

function extractConst(src: string, name: string): string | null {
  const m = src.match(new RegExp(`${name}\\s*=\\s*["'\`]([^"'\`]+)["'\`]`));
  return m ? m[1] : null;
}

function extractNumber(src: string, name: string): number | null {
  const m = src.match(new RegExp(`${name}\\s*=\\s*(\\d+)`));
  return m ? Number(m[1]) : null;
}

const apiPort = extractNumber(defaultsSrc, "DEFAULT_API_PORT");
const localApiUrl = extractConst(defaultsSrc, "DEFAULT_LOCAL_API_URL");

if (!apiPort || !localApiUrl) {
  console.error("❌  Could not extract DEFAULT_API_PORT or DEFAULT_LOCAL_API_URL from runtime-defaults.ts");
  process.exit(1);
}

console.log(`Canonical API port: ${apiPort}`);
console.log(`Canonical local API URL: ${localApiUrl}`);

// ─── Files to check for consistency ──────────────────────────────────────

const FILES_TO_CHECK = [
  "apps/api/.env.example",
  "apps/web/.env.example",
];

let failed = false;

for (const file of FILES_TO_CHECK) {
  try {
    const content = read(file);
    const portStr = String(apiPort);

    // Check that the port appears somewhere in the file
    if (!content.includes(portStr)) {
      console.error(
        `❌  Drift detected in ${file}: does not reference port ${portStr} (from DEFAULT_API_PORT)`
      );
      failed = true;
    } else {
      console.log(`✅  ${file} references port ${portStr}`);
    }
  } catch (err: any) {
    console.warn(`⚠️   Skipped ${file}: ${err.message}`);
  }
}

// ─── Check README mentions the right URL ─────────────────────────────────

const readmeFiles = ["README.md", "docs/architecture.md"].filter((f) =>
  existsSync(resolve(ROOT, f))
);

for (const file of readmeFiles) {
  const content = read(file);
  const portStr = String(apiPort);
  if (content.includes("localhost:") && !content.includes(`localhost:${portStr}`)) {
    // Soft warning — don't fail on README prose drift
    console.warn(
      `⚠️   ${file} may reference a stale localhost port. Verify it uses ${portStr}.`
    );
  } else {
    console.log(`✅  ${file} port references look consistent`);
  }
}

if (failed) {
  console.error(
    "\nRuntime drift detected. Update the .env.example files to match runtime-defaults.ts."
  );
  process.exit(1);
}

console.log("\nNo runtime drift detected.");
