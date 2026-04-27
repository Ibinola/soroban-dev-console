/**
 * DEVOPS-027: Documents and validates the branch-protected contribution workflow.
 * Checks that local branch names follow the convention before pushing.
 */

import { execSync } from "child_process";

const PROTECTED_BRANCHES = ["main", "master", "release"];

const ALLOWED_PREFIXES = [
  "feat/",
  "fix/",
  "chore/",
  "docs/",
  "audit/",
  "cleanup/",
  "devops/",
];

function getCurrentBranch(): string {
  return execSync("git rev-parse --abbrev-ref HEAD").toString().trim();
}

function validateBranch(branch: string): void {
  if (PROTECTED_BRANCHES.includes(branch)) {
    console.error(`[FAIL] Direct push to '${branch}' is not allowed.`);
    console.error("Create a feature branch and open a PR instead.");
    console.error(`Allowed prefixes: ${ALLOWED_PREFIXES.join(", ")}`);
    process.exit(1);
  }

  const hasValidPrefix = ALLOWED_PREFIXES.some((p) => branch.startsWith(p));
  if (!hasValidPrefix) {
    console.warn(`[WARN] Branch '${branch}' does not follow naming conventions.`);
    console.warn(`Expected one of: ${ALLOWED_PREFIXES.join(", ")}`);
  } else {
    console.log(`[OK]  Branch '${branch}' follows the contribution workflow.`);
  }

  console.log("\nWorkflow reminder:");
  console.log("  1. Branch from main using an allowed prefix");
  console.log("  2. Push your branch and open a PR");
  console.log("  3. Audit/cleanup branches follow the same PR-based flow");
}

const branch = getCurrentBranch();
validateBranch(branch);
