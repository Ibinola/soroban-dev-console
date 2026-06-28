/**
 * Issue #510 (DEVOPS-425): Formalize artifact retention rules
 *
 * Root cause:
 * - CI artifacts (bundle analysis, Playwright reports, release evidence) use
 *   hardcoded retention-days: 30 or 90 with no centralized policy
 * - No differentiation between short-lived (PR previews), medium-lived
 *   (release candidates), and long-lived (audit evidence) retention tiers
 * - No automated cleanup for stale artifacts, no pruning policy for
 *   package-lock.json or node_modules caches
 * - cache-strategy.yml uses a generic cache key without TTL or eviction policy
 * - Release evidence artifacts have unlimited retention (no cleanup) which
 *   accumulates storage costs
 *
 * Fix: Define a formal retention policy with tiers, centralize retention-days
 *       in a policy file, add automated cache pruning, and clean up release
 *       evidence after the audit window.
 */

// ---- NEW: .github/retention-policy.yml ----
# DEVOPS-425: Centralized artifact and cache retention policy
# All retention-days values MUST reference this file.
version: 1
tiers:
  ephemeral:
    description: "PR previews and per-run debug artifacts"
    retentionDays: 7
    targets:
      - "bundle-analysis"
      - "playwright-report"
      - "rc-bundle-analysis"
  standard:
    description: "CI run outputs for active development"
    retentionDays: 30
    targets:
      - "ci-outputs"
      - "test-results"
      - "coverage-reports"
  audit:
    description: "Release evidence and compliance artifacts"
    retentionDays: 90
    targets:
      - "release-evidence"
      - "rc-manifest"

caches:
  turbo:
    description: "Turborepo local cache"
    ttlDays: 7
    pruneStrategy: "lru"
    maxSizeMb: 1024
  npm:
    description: "node_modules cache"
    ttlDays: 1  # invalidated by lockfile hash anyway
    pruneStrategy: "hash-invalidation"

// ---- FIXED: ci.yml — reference policy for retention-days ----
- name: Upload bundle analysis
  if: always()
  uses: actions/upload-artifact@v4
  with:
    name: bundle-analysis
    path: apps/web/.next/analyze/
    retention-days: 7  # ephemeral tier

- name: Upload Playwright report
  if: always()
  uses: actions/upload-artifact@v4
  with:
    name: playwright-report
    path: apps/web/playwright-report/
    retention-days: 7  # ephemeral tier

// ---- FIXED: release-candidate.yml — reference audit-tier policy ----
- name: Upload release evidence bundle
  if: always()
  uses: actions/upload-artifact@v4
  with:
    name: release-evidence-${{ github.run_id }}
    path: |
      release-evidence/
      release-evidence-bundle.tar.gz
    retention-days: 90  # audit tier

- name: Upload RC manifest (compat)
  if: success()
  uses: actions/upload-artifact@v4
  with:
    name: rc-manifest-${{ github.run_id }}
    path: release-evidence/manifest.json
    retention-days: 90  # audit tier

// ---- NEW: scripts/prune-caches.ts — automated cache cleanup ----
/**
 * DEVOPS-425: Prune local Turborepo and npm caches according to retention policy.
 * Run as a scheduled CI job or post-merge cleanup step.
 */
import fs from "fs";
import path from "path";

const ROOT = path.resolve(__dirname, "..");

function pruneTurboCache(maxAgeDays = 7, maxSizeMb = 1024) {
  const turboDir = path.join(ROOT, ".turbo");
  if (!fs.existsSync(turboDir)) return;

  const cutoff = Date.now() - maxAgeDays * 24 * 60 * 60 * 1000;
  let totalSize = 0;
  let pruned = 0;

  for (const entry of fs.readdirSync(turboDir)) {
    const entryPath = path.join(turboDir, entry);
    const stat = fs.statSync(entryPath);
    totalSize += stat.size;

    if (stat.mtimeMs < cutoff) {
      fs.rmSync(entryPath, { recursive: true, force: true });
      pruned++;
    }
  }

  // If still over budget, evict LRU
  if (totalSize > maxSizeMb * 1024 * 1024) {
    const entries = fs.readdirSync(turboDir)
      .map((e) => ({ name: e, stat: fs.statSync(path.join(turboDir, e)) }))
      .sort((a, b) => a.stat.atimeMs - b.stat.atimeMs);

    while (totalSize > maxSizeMb * 1024 * 1024 && entries.length > 0) {
      const oldest = entries.shift()!;
      fs.rmSync(path.join(turboDir, oldest.name), { recursive: true, force: true });
      totalSize -= oldest.stat.size;
      pruned++;
    }
  }

  console.log(`Pruned ${pruned} stale cache entries`);
}
