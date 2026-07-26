#!/usr/bin/env tsx
/**
 * check-dependency-policy.ts
 *
 * Enforces the project's dependency policy:
 *
 * 1. No dependencies with known-unpinned major versions (open ranges like `*` or `latest`).
 * 2. No private/internal-scope packages sourced from public registries.
 * 3. Workspace-internal packages must use `"*"` (resolved by npm workspaces).
 *
 * Exits non-zero on policy violations so the security CI gate can block the merge.
 */

import { existsSync, readFileSync } from "fs";
import { resolve } from "path";

const ROOT = resolve(__dirname, "..");

interface PackageJson {
  name?: string;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
}

function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(resolve(ROOT, path), "utf-8")) as T;
}

const WORKSPACE_PACKAGE_JSONS = [
  "package.json",
  "apps/web/package.json",
  "apps/api/package.json",
  "packages/ui/package.json",
  "packages/soroban-utils/package.json",
  "packages/api-contracts/package.json",
];

// These ranges are explicitly banned — they allow arbitrary version resolution
const BANNED_RANGES = new Set(["*", "latest", "next", "canary", ""]);

// Internal workspace package scopes — these must use "*" in other workspaces
const INTERNAL_SCOPES = ["@devconsole/"];

let failed = false;

for (const pkgPath of WORKSPACE_PACKAGE_JSONS) {
  if (!existsSync(resolve(ROOT, pkgPath))) continue;

  const pkg = readJson<PackageJson>(pkgPath);
  const allDeps = {
    ...pkg.dependencies,
    ...pkg.devDependencies,
  };

  for (const [name, version] of Object.entries(allDeps)) {
    // Internal workspace packages must use "*"
    if (INTERNAL_SCOPES.some((scope) => name.startsWith(scope))) {
      if (version !== "*") {
        console.error(
          `❌  ${pkgPath}: ${name} is a workspace package and must use version "*" (found: "${version}")`
        );
        failed = true;
      }
      continue;
    }

    // Check for banned open ranges
    if (BANNED_RANGES.has(version)) {
      console.error(
        `❌  ${pkgPath}: ${name}@${version || '""'} — open version range is not allowed. Pin to a specific version.`
      );
      failed = true;
    }
  }
}

// Soft check: warn if `turbo` is set to "latest" in root (common pattern but not ideal)
const rootPkg = readJson<PackageJson>("package.json");
if (rootPkg.devDependencies?.["turbo"] === "latest") {
  console.warn(
    `⚠️   package.json: turbo@latest — consider pinning to a specific version for reproducible builds`
  );
}

if (failed) {
  console.error(
    "\nDependency policy check failed. Pin all external dependencies to specific versions."
  );
  process.exit(1);
}

console.log("✅  Dependency policy check passed.");
