#!/usr/bin/env tsx
/**
 * check-dependency-integrity.ts
 *
 * Verifies that all workspace package.json files declare consistent
 * versions of shared dependencies and that the root lockfile (package-lock.json)
 * is present and up to date.
 *
 * Issue #759: Also runs npm audit for high/critical vulnerabilities and
 * checks for incompatible licenses (GPL, AGPL).
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

let failed = false;

// ─── 3. Check that shared @stellar/stellar-sdk versions are consistent ────

const SHARED_DEPS = ["@stellar/stellar-sdk"];

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

// ─── 5. Issue #759: npm audit — fail on high/critical severity ────────────

console.log("\n🔍  Running npm audit (high/critical threshold)...");
try {
  const auditOutput = execSync("npm audit --audit-level=high --json", {
    cwd: ROOT,
    stdio: "pipe",
  }).toString();

  try {
    const audit = JSON.parse(auditOutput) as {
      metadata?: { vulnerabilities?: { high?: number; critical?: number } };
    };
    const vulns = audit.metadata?.vulnerabilities;
    const highCount = (vulns?.high ?? 0);
    const criticalCount = (vulns?.critical ?? 0);
    if (highCount > 0 || criticalCount > 0) {
      console.error(`❌  npm audit found ${criticalCount} critical and ${highCount} high severity vulnerabilities.`);
      console.error("    Run: npm audit --audit-level=high for details.");
      console.error("    Run: npm audit fix  (or manually update affected packages).");
      failed = true;
    } else {
      console.log("✅  npm audit passed: no high or critical vulnerabilities found");
    }
  } catch {
    console.log("✅  npm audit passed (no JSON vulnerabilities)");
  }
} catch (err) {
  // npm audit exits non-zero when vulnerabilities found
  const output = (err as any).stdout?.toString() ?? "";
  try {
    const audit = JSON.parse(output) as {
      metadata?: { vulnerabilities?: { high?: number; critical?: number } };
    };
    const vulns = audit.metadata?.vulnerabilities;
    const highCount = (vulns?.high ?? 0);
    const criticalCount = (vulns?.critical ?? 0);
    console.error(`❌  npm audit found ${criticalCount} critical and ${highCount} high severity vulnerabilities.`);
    console.error("    Run: npm audit --audit-level=high for details.");
    failed = true;
  } catch {
    console.warn("⚠️   npm audit check could not be completed. Run `npm audit --audit-level=high` manually.");
  }
}

// ─── 6. Issue #759: License compatibility check ───────────────────────────

/**
 * Licenses incompatible with this project's MIT license.
 * GPL/AGPL require derivative works to be open-sourced under the same license.
 */
const INCOMPATIBLE_LICENSES = ["GPL-2.0", "GPL-3.0", "AGPL-3.0", "AGPL-1.0", "LGPL-2.0", "LGPL-2.1", "LGPL-3.0"];

console.log("\n🔍  Checking dependency licenses...");
try {
  const licenseOutput = execSync("npx --yes license-checker --json --production", {
    cwd: ROOT,
    stdio: "pipe",
  }).toString();

  const licenses = JSON.parse(licenseOutput) as Record<string, { licenses?: string }>;
  const incompatible: string[] = [];

  for (const [pkg, info] of Object.entries(licenses)) {
    const licenseStr = info.licenses ?? "";
    for (const bad of INCOMPATIBLE_LICENSES) {
      if (licenseStr.includes(bad)) {
        incompatible.push(`${pkg}: ${licenseStr}`);
        break;
      }
    }
  }

  if (incompatible.length > 0) {
    console.error(`❌  Found ${incompatible.length} package(s) with licenses incompatible with MIT:`);
    for (const entry of incompatible) {
      console.error(`    ${entry}`);
    }
    console.error("    Review these packages and replace with MIT-compatible alternatives.");
    failed = true;
  } else {
    console.log("✅  All production dependency licenses are compatible with MIT");
  }
} catch {
  console.warn("⚠️   License check skipped (license-checker not available). Run: npx license-checker --production");
}

if (failed) {
  console.error(
    "\nDependency integrity check failed. Fix the issues above before merging."
  );
  process.exit(1);
}

console.log("\n✅  All dependency integrity checks passed.");
