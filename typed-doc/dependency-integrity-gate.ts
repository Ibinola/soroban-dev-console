/**
 * Issue #507 (DEVOPS-422): Add a dependency integrity gate
 *
 * Problem: The existing check-dependency-integrity.ts runs as a script
 * but is not enforced as a CI gate. Dependency changes can be merged
 * without lockfile verification, audit metadata, or supply-chain checks.
 *
 * Solution: Formalise the integrity check as a required CI gate that
 * blocks the PR if any dependency issue is found. Add audit metadata
 * validation and supply-chain verification.
 */

// ---- NEW: CI gate job in ci.yml ----
dependency-gate:
  name: Dependency Integrity Gate
  needs: changes
  if: |
    needs.changes.outputs.devops == 'true'
    || contains(needs.changes.outputs.packages-list, 'package.json')
    || github.event_name == 'push'
  runs-on: ubuntu-latest
  steps:
    - uses: actions/checkout@v4

    - uses: actions/setup-node@v4
      with:
        node-version: 20
        cache: "npm"

    - name: Install dependencies
      run: npm ci

    - name: Check dependency integrity
      id: integrity
      run: npm run check-integrity

    - name: Check dependency policy
      id: policy
      run: npx tsx scripts/check-dependency-policy.ts

    - name: Audit production dependencies
      id: audit
      run: npm audit --audit-level=high

    - name: Verify lockfile is up to date
      id: lockfile
      run: |
        BEFORE=$(md5sum package-lock.json)
        npm install --package-lock-only
        AFTER=$(md5sum package-lock.json)
        if [ "$BEFORE" != "$AFTER" ]; then
          echo "❌ Lockfile drift detected"
          exit 1
        fi
        echo "✅ Lockfile is consistent"

    - name: Check for unexpected dependency upgrades
      id: upgrades
      run: npx tsx scripts/check-unexpected-upgrades.ts

    - name: Write gate summary
      if: always()
      run: |
        echo "## Dependency Integrity Gate" >> $GITHUB_STEP_SUMMARY
        for step in integrity policy audit lockfile upgrades; do
          outcome=$(eval "echo \${{ steps.$step.outcome }}")
          if [ "$outcome" = "success" ]; then
            echo "✅ **$step**: passed" >> $GITHUB_STEP_SUMMARY
          else
            echo "❌ **$step**: failed" >> $GITHUB_STEP_SUMMARY
          fi
        done

// Update the required-checks job to include the dependency gate
required-checks:
  name: Required Checks
  needs: [devops, dependency-gate]
  if: always()
  runs-on: ubuntu-latest
  steps:
    - name: Assert required gates passed
      run: |
        for gate in devops dependency-gate; do
          result=$(echo '${{ toJSON(needs) }}' | python3 -c "
            import sys, json
            d = json.load(sys.stdin)
            print(d.get('$gate', {}).get('result', 'skipped'))
          ")
          if [ "$result" = "failure" ]; then
            echo "❌ Gate '$gate' failed"
            exit 1
          fi
        done
        echo "✅ All required gates passed"

// ---- NEW: scripts/check-unexpected-upgrades.ts ----
/**
 * DEVOPS-422: Detect unexpected dependency upgrades in a PR.
 * Compares package.json changes against dependency-policy.json rules.
 */
import fs from "fs";
import path from "path";
import { execSync } from "child_process";

const ROOT = path.resolve(__dirname, "..");
const POLICY_FILE = path.join(ROOT, "dependency-policy.json");

interface Policy {
  criticalPackages: string[];
  rules: {
    patch: { autoMerge: boolean };
    minor: { critical: { autoMerge: boolean; requiredReviewers: number } };
    major: { autoMerge: boolean; requiredReviewers: number; blockDuringWave: boolean };
  };
  freeze?: { enabled: boolean };
}

const policy: Policy = JSON.parse(fs.readFileSync(POLICY_FILE, "utf-8"));

// Get changed package.json files in this PR
const baseSha = process.env.BASE_SHA || "origin/main";
const changedFiles = execSync(
  `git diff --name-only ${baseSha}...HEAD`, { encoding: "utf-8" }
).trim().split("\n").filter(f => f.endsWith("package.json"));

let errors = 0;

for (const file of changedFiles) {
  const fullPath = path.join(ROOT, file);
  const diff = execSync(
    `git diff ${baseSha}...HEAD -- "${file}"`, { encoding: "utf-8" }
  );

  // Parse diff lines for dependency version changes
  const depLines = diff.split("\n").filter(l =>
    l.startsWith("+") || l.startsWith("-")
  );

  for (const line of depLines) {
    const match = line.match(/["']([^"']+)["']:\s*["']\^?(\d+)\.(\d+)\.(\d+)["']/);
    if (!match) continue;

    const [, pkg, major, minor] = match;
    const isCritical = policy.criticalPackages.includes(pkg);
    const isAdd = line.startsWith("+");
    const isRemove = line.startsWith("-");

    if (isAdd && isCritical) {
      console.warn(`⚠️  Critical package added/updated: ${pkg}@${major}.${minor}.x`);
      console.warn(`   File: ${file}`);
      console.warn(`   Review required per dependency-policy.json`);
    }

    // Check if a major version bump occurred for critical packages
    if (isCritical && isAdd) {
      // Extract previous version from the removed line
      const prevLine = depLines.find(l =>
        l.startsWith("-") && l.includes(pkg)
      );
      if (prevLine) {
        const prevMatch = prevLine.match(/["'](\d+)\.(\d+)\.(\d+)["']/);
        if (prevMatch && prevMatch[1] !== major) {
          console.error(`❌ Major version bump detected for critical package "${pkg}":`);
          console.error(`   ${prevMatch[1]}.${prevMatch[2]}.${prevMatch[3]} → ${major}.${minor}.x`);
          console.error(`   Blocked per dependency-policy.json major rules`);
          errors++;
        }
      }
    }
  }
}

if (errors > 0) {
  console.error(`\n💥 ${errors} unexpected upgrade(s) blocked`);
  process.exit(1);
}

console.log("✅ All dependency changes comply with policy");
