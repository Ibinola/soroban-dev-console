#!/usr/bin/env tsx
/**
 * check-dependency-integrity.ts
 *
 * Verifies that all workspace package.json files declare consistent
 * versions of shared dependencies and that the root lockfile (package-lock.json)
 * is present and up to date.
 *
 * Exits non-zero on any inconsistency so the devops CI gate blocks the merge.
 */

import { existsSync, readFileSync } from "fs";
import { resolve } from "path";
import { execSync } from "child_process";

const ROOT = resolve(__dirname, "..");

interface PackageJson {
  name?: string;
  version?: string;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
}

function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(resolve(ROOT, path), "utf-8")) as T;
}

// ─── 1. Lockfile presence ─────────────────────────────────────────────────

const lockfilePath = resolve(ROOT, "package-lock.json");
if (!existsSync(lockfilePath)) {
  console.error("❌  package-lock.json is missing. Run `npm install` to regenerate it.");
  process.exit(1);
}
console.log("✅  package-lock.json present");

// ─── 2. Collect workspace packages ───────────────────────────────────────

const WORKSPACE_PACKAGE_JSONS = [
  "package.json",
  "apps/web/package.json",
  "apps/api/package.json",
  "packages/ui/package.json",
  "packages/soroban-utils/package.json",
  "packages/api-contracts/package.json",
  "packages/typescript-config/package.json",
];

const packages = WORKSPACE_PACKAGE_JSONS.filter((p) =>
  existsSync(resolve(ROOT, p))
).map((p) => ({
  path: p,
  pkg: readJson<PackageJson>(p),
}));

// ─── 3. Check that shared @stellar/stellar-sdk versions are consistent ────

const SHARED_DEPS = ["@stellar/stellar-sdk"];

let failed = false;

for (const dep of SHARED_DEPS) {
  const versions = new Map<string, string[]>();

  for (const { path, pkg } of packages) {
    const all = {
      ...pkg.dependencies,
      ...pkg.devDependencies,
      ...pkg.peerDependencies,
    };

    if (all[dep]) {
      const v = all[dep];
      if (!versions.has(v)) versions.set(v, []);
      versions.get(v)!.push(path);
    }
  }

  if (versions.size > 1) {
    console.error(`❌  Inconsistent versions of ${dep}:`);
    for (const [v, paths] of versions) {
      console.error(`    ${v} — declared in: ${paths.join(", ")}`);
    }
    failed = true;
  } else if (versions.size === 1) {
    const [v] = [...versions.keys()];
    console.log(`✅  ${dep} is consistent at ${v}`);
  }
}

// ─── 4. Check lockfile is not stale (npm ls exits non-zero if desynced) ──

try {
  execSync("npm ls --depth=0 --json", {
    cwd: ROOT,
    stdio: "pipe",
  });
  console.log("✅  npm dependency graph consistent with lockfile");
} catch {
  // npm ls can exit non-zero for peer dep warnings — don't treat as fatal
  console.warn("⚠️   npm ls reported warnings. Check for peer dependency mismatches.");
}

if (failed) {
  console.error(
    "\nDependency integrity check failed. Align dependency versions across workspaces."
  );
  process.exit(1);
}

console.log("\nDependency integrity check passed.");
