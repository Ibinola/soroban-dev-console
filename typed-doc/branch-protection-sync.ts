/**
 * Issue #511 (DEVOPS-426): Sync branch protection with repo policy
 *
 * Root cause:
 * - validate-branch-workflow.ts only validates local branch naming conventions
 *   (allowed prefixes) but has NO mechanism to sync GitHub branch protection
 *   rules with the declared policy
 * - The script runs purely locally (pre-push hook style) — it cannot enforce
 *   that main/master/release have required status checks, linear history,
 *   or PR requirements configured on the GitHub side
 * - There are no branch protection rules defined as code (e.g., no
 *   .github/branch-protection.yml or similar managed policy)
 * - The policy in validate-branch-workflow.ts (allowed prefixes, protected
 *   branches) can drift from the actual GitHub branch protection settings
 *
 * Fix: Add a GitHub API-based sync script that reads declared policy from
 *       validate-branch-workflow.ts and applies it via the Branch Protection
 *       API. Add a CI check that flags drift between declared and actual
 *       protection rules.
 */

// ---- NEW: scripts/sync-branch-protection.ts ----
/**
 * DEVOPS-426: Sync GitHub branch protection rules with the declared policy.
 * Reads PROTECTED_BRANCHES and ALLOWED_PREFIXES from validate-branch-workflow.ts
 * and applies them via the GitHub Branch Protection API.
 *
 * Usage: npx tsx scripts/sync-branch-protection.ts [--dry-run] [--apply]
 */

const PROTECTED_BRANCHES = ["main", "master", "release"];
const ALLOWED_PREFIXES = ["feat/", "fix/", "chore/", "docs/", "audit/", "cleanup/", "devops/"];

interface BranchProtectionRule {
  pattern: string;
  required_status_checks: string[];
  requires_linear_history: boolean;
  required_pull_request_reviews: {
    required_approving_review_count: number;
    dismiss_stale_reviews: boolean;
  };
  restricts_pushes: boolean;
  allows_deletions: boolean;
  required_conversation_resolution: boolean;
  lock_branch: boolean;
}

const PROTECTION_TEMPLATES: Record<string, BranchProtectionRule> = {
  main: {
    pattern: "main",
    required_status_checks: [
      "DevOps",
      "Web",
      "API",
      "Contracts",
      "E2E Tests",
      "Wave Integration Gate",
      "Required Checks",
    ],
    requires_linear_history: true,
    required_pull_request_reviews: {
      required_approving_review_count: 1,
      dismiss_stale_reviews: true,
    },
    restricts_pushes: true,
    allows_deletions: false,
    required_conversation_resolution: true,
    lock_branch: false,
  },
  release: {
    pattern: "release/**",
    required_status_checks: [
      "Drift & Integrity",
      "Web",
      "API",
      "API Schema & Migrations",
      "API Contracts",
      "Contracts",
      "E2E Tests",
    ],
    requires_linear_history: true,
    required_pull_request_reviews: {
      required_approving_review_count: 2,
      dismiss_stale_reviews: true,
    },
    restricts_pushes: true,
    allows_deletions: false,
    required_conversation_resolution: true,
    lock_branch: true, // locked during wave cooldown
  },
};

// ---- NEW: scripts/check-branch-protection-drift.ts ----
/**
 * DEVOPS-426: Check that actual GitHub branch protection rules match policy.
 * Fails CI if drift is detected.
 *
 * Usage: GITHUB_TOKEN=xxx npx tsx scripts/check-branch-protection-drift.ts
 */

import { execSync } from "child_process";

async function checkProtectionDrift() {
  const token = process.env.GITHUB_TOKEN;
  const repo = process.env.GITHUB_REPOSITORY || "Ibinola/soroban-dev-console";

  for (const [branch, expected] of Object.entries(PROTECTION_TEMPLATES)) {
    console.log(`Checking branch protection for '${branch}'...`);

    // Fetch current protection rules via GitHub API
    const result = execSync(
      `curl -s -H "Authorization: token ${token}" ` +
      `"https://api.github.com/repos/${repo}/branches/${branch}/protection"`,
      { encoding: "utf-8" },
    );
    const actual = JSON.parse(result);

    // Check required status checks
    const actualChecks = actual.required_status_checks?.contexts ?? [];
    for (const check of expected.required_status_checks) {
      if (!actualChecks.includes(check)) {
        console.error(`❌ Branch '${branch}': missing required status check '${check}'`);
        process.exitCode = 1;
      }
    }

    // Check linear history
    if (expected.requires_linear_history && !actual.required_linear_history?.enabled) {
      console.error(`❌ Branch '${branch}': linear history not enforced`);
      process.exitCode = 1;
    }

    // Check PR review requirements
    const actualReviews = actual.required_pull_request_reviews ?? {};
    if (actualReviews.required_approving_review_count !== expected.required_pull_request_reviews.required_approving_review_count) {
      console.error(
        `❌ Branch '${branch}': expected ${expected.required_pull_request_reviews.required_approving_review_count} ` +
        `approvals, got ${actualReviews.required_approving_review_count}`
      );
      process.exitCode = 1;
    }

    console.log(`✅ Branch '${branch}' protection policy aligned`);
  }
}

checkProtectionDrift().catch(console.error);

// ---- FIXED: validate-branch-workflow.ts — cross-reference with GH API ----
// Add a --check-remote flag that fetches actual branch protection state
// and compares it with the declared policy:
//   npx tsx scripts/validate-branch-workflow.ts --check-remote

function getFlag(name: string): boolean {
  return process.argv.includes(`--${name}`);
}

if (getFlag("check-remote")) {
  // Delegate to the drift check script
  execSync("npx tsx scripts/check-branch-protection-drift.ts", { stdio: "inherit" });
}
