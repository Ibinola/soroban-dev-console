#!/usr/bin/env tsx
/**
 * validate-playbooks.ts
 *
 * Checks that required operational runbooks and playbooks are present and
 * have minimum expected content. Exits non-zero if any are missing or empty.
 */

import { existsSync, readFileSync, statSync } from "fs";
import { resolve } from "path";

const ROOT = resolve(__dirname, "..");

interface PlaybookSpec {
  path: string;
  minBytes: number;
  description: string;
}

const REQUIRED_PLAYBOOKS: PlaybookSpec[] = [
  {
    path: "docs/runbooks.md",
    minBytes: 100,
    description: "Operational runbooks",
  },
  {
    path: "docs/observability.md",
    minBytes: 100,
    description: "Observability guide",
  },
  {
    path: "docs/backup-restore-drill.md",
    minBytes: 100,
    description: "Backup and restore drill",
  },
];

let failed = false;

for (const spec of REQUIRED_PLAYBOOKS) {
  const fullPath = resolve(ROOT, spec.path);

  if (!existsSync(fullPath)) {
    console.error(`❌  Missing: ${spec.path} — ${spec.description}`);
    failed = true;
    continue;
  }

  const size = statSync(fullPath).size;
  if (size < spec.minBytes) {
    console.error(
      `❌  Too small: ${spec.path} (${size} bytes, need ≥ ${spec.minBytes}) — ${spec.description}`
    );
    failed = true;
    continue;
  }

  console.log(`✅  OK: ${spec.path}`);
}

if (failed) {
  console.error("\nPlaybook validation failed. Add the missing documents before merging.");
  process.exit(1);
}

console.log("\nAll playbooks present and non-empty.");
