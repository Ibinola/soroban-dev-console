#!/usr/bin/env tsx
/**
 * validate-branch-workflow.ts
 *
 * Checks that the repository's branch-protection configuration and
 * PR template are in place. In CI this runs as a soft advisory — it
 * warns but does not block unless critical files are entirely absent.
 *
 * Exits non-zero only if the PR template is completely missing (CI
 * gate requirement).
 */

import { existsSync, readFileSync, statSync } from "fs";
import { resolve } from "path";

const ROOT = resolve(__dirname, "..");

interface FileSpec {
  path: string;
  minBytes: number;
  blocking: boolean;
  description: string;
}

const REQUIRED: FileSpec[] = [
  {
    path: ".github/pull_request_template.md",
    minBytes: 50,
    blocking: true,
    description: "GitHub PR template",
  },
  {
    path: "docs/branch-protection.md",
    minBytes: 50,
    blocking: false,
    description: "Branch protection documentation",
  },
  {
    path: "docs/branch-pr-workflow.md",
    minBytes: 50,
    blocking: false,
    description: "Branch and PR workflow documentation",
  },
  {
    path: "CONTRIBUTING.md",
    minBytes: 200,
    blocking: false,
    description: "Contributor guide",
  },
];

let failed = false;

for (const spec of REQUIRED) {
  const full = resolve(ROOT, spec.path);

  if (!existsSync(full)) {
    const prefix = spec.blocking ? "❌ " : "⚠️ ";
    console.error(`${prefix} Missing: ${spec.path} — ${spec.description}`);
    if (spec.blocking) failed = true;
    continue;
  }

  const size = statSync(full).size;
  if (size < spec.minBytes) {
    const prefix = spec.blocking ? "❌ " : "⚠️ ";
    console.error(
      `${prefix} Too small: ${spec.path} (${size} bytes, need ≥ ${spec.minBytes}) — ${spec.description}`
    );
    if (spec.blocking) failed = true;
    continue;
  }

  console.log(`✅  OK: ${spec.path}`);
}

if (failed) {
  console.error("\nBranch workflow validation failed. Add the missing required files.");
  process.exit(1);
}

console.log("\nBranch workflow validation passed.");
