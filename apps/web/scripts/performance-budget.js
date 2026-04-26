#!/usr/bin/env node
/**
 * Performance budget checker for Next.js App Router + Turbopack output.
 *
 * Closes #275 — make web performance-budget checks App Router and Turbopack aware.
 *
 * Reads .next/build-manifest.json (App Router) and checks that no individual
 * JS chunk exceeds the configured size budgets.
 */

const fs = require("fs");
const path = require("path");

const NEXT_DIR = path.resolve(__dirname, "../.next");
const BUILD_MANIFEST = path.join(NEXT_DIR, "build-manifest.json");
const APP_BUILD_MANIFEST = path.join(NEXT_DIR, "app-build-manifest.json");

/** Size budgets in bytes */
const BUDGETS = {
  /** Max size for any single shared chunk */
  sharedChunk: 250 * 1024, // 250 kB
  /** Max size for any single route entry chunk */
  routeChunk: 150 * 1024, // 150 kB
};

function getFileSizeBytes(relativePath) {
  const abs = path.join(NEXT_DIR, relativePath);
  try {
    return fs.statSync(abs).size;
  } catch {
    return 0;
  }
}

function checkManifest(manifestPath, label) {
  if (!fs.existsSync(manifestPath)) {
    console.warn(`[perf-budget] ${label} not found — skipping.`);
    return true;
  }

  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  const pages = manifest.pages ?? manifest.rootMainFiles ?? {};
  let passed = true;

  for (const [route, chunks] of Object.entries(pages)) {
    for (const chunk of chunks) {
      const size = getFileSizeBytes(chunk);
      const budget = chunk.includes("/_next/static/chunks/")
        ? BUDGETS.sharedChunk
        : BUDGETS.routeChunk;

      if (size > budget) {
        console.error(
          `[perf-budget] FAIL  ${route} → ${chunk} (${(size / 1024).toFixed(1)} kB > ${budget / 1024} kB budget)`
        );
        passed = false;
      } else if (size > 0) {
        console.log(
          `[perf-budget] OK    ${route} → ${chunk} (${(size / 1024).toFixed(1)} kB)`
        );
      }
    }
  }

  return passed;
}

const ok =
  checkManifest(BUILD_MANIFEST, "build-manifest.json (pages)") &
  checkManifest(APP_BUILD_MANIFEST, "app-build-manifest.json (App Router)");

if (!ok) {
  console.error("\n[perf-budget] One or more chunks exceeded their budget.");
  process.exit(1);
} else {
  console.log("\n[perf-budget] All chunks within budget.");
}
