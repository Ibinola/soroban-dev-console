#!/usr/bin/env tsx
/**
 * verify-build-order.ts
 *
 * Checks that the turbo.json task graph has the expected `dependsOn` entries
 * for critical tasks and that shared packages list their build scripts
 * so turbo can orchestrate them in the correct order.
 *
 * Exits non-zero on violations so the wave-prep CI gate can catch regressions.
 */

import { existsSync, readFileSync } from "fs";
import { resolve } from "path";

const ROOT = resolve(__dirname, "..");

function readJson<T>(path: string): T {
  const full = resolve(ROOT, path);
  if (!existsSync(full)) throw new Error(`File not found: ${path}`);
  return JSON.parse(readFileSync(full, "utf-8")) as T;
}

interface TurboTask {
  dependsOn?: string[];
  outputs?: string[];
  inputs?: string[];
  cache?: boolean;
  persistent?: boolean;
}

interface TurboJson {
  tasks?: Record<string, TurboTask>;
}

const turbo = readJson<TurboJson>("turbo.json");
const tasks = turbo.tasks ?? {};

let failed = false;

// ─── Rule 1: build must declare `^build` dep (workspace dependency ordering) ─

if (!tasks.build?.dependsOn?.includes("^build")) {
  console.error(`❌  turbo.json 'build' task must declare dependsOn: ["^build"] for correct workspace ordering`);
  failed = true;
} else {
  console.log(`✅  build task declares ^build dependency`);
}

// ─── Rule 2: lint and typecheck must depend on ^build ─────────────────────

for (const task of ["lint", "typecheck"] as const) {
  if (!tasks[task]?.dependsOn?.includes("^build")) {
    console.error(`❌  turbo.json '${task}' task should declare dependsOn: ["^build"]`);
    failed = true;
  } else {
    console.log(`✅  ${task} task declares ^build dependency`);
  }
}

// ─── Rule 3: each workspace package must have a build script ─────────────

const PACKAGES = [
  "packages/ui/package.json",
  "packages/soroban-utils/package.json",
  "packages/api-contracts/package.json",
];

for (const pkgPath of PACKAGES) {
  try {
    const pkg = readJson<{ scripts?: Record<string, string> }>(pkgPath);
    if (!pkg.scripts?.build) {
      console.error(`❌  ${pkgPath} is missing a 'build' script. Turbo cannot order it correctly.`);
      failed = true;
    } else {
      console.log(`✅  ${pkgPath} has a build script`);
    }
  } catch (err: any) {
    console.warn(`⚠️   Skipped ${pkgPath}: ${err.message}`);
  }
}

if (failed) {
  console.error("\nBuild order validation failed.");
  process.exit(1);
}

console.log("\nBuild order is valid.");
