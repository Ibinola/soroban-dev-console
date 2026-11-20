import fs from "node:fs";
import path from "node:path";
import process from "node:process";

/**
 * Pre-commit variant of the secret scanner.
 * Receives file paths from lint-staged and checks each one for credential patterns.
 * Exits non-zero to block the commit if any secrets are detected.
 */

const EXCLUDE_PARTS = ["/node_modules/", "/dist/", "/target/", "/.git/", "/.turbo/", "/.backups/", "/.next/"];

const PATTERNS = [
  { rule: "email", regex: /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi },
  { rule: "jwt", regex: /eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g },
  { rule: "stellar_secret", regex: /S[A-Z2-7]{55}/g },
  { rule: "long_hex_secret", regex: /\b[a-f0-9]{64,}\b/gi },
  { rule: "api_key", regex: /\b(?:api[_-]?key|api[_-]?token|access[_-]?token)[=:]["']?[A-Za-z0-9_\-]{16,}["']?/gi },
  { rule: "bearer_token", regex: /Bearer\s+[A-Za-z0-9\-._~+/]+=*/g },
  { rule: "ghp_token", regex: /ghp_[A-Za-z0-9]{36,}/g },
  { rule: "gho_token", regex: /gho_[A-Za-z0-9]{36,}/g },
  { rule: "npm_token", regex: /npm_[A-Za-z0-9]{36,}/g },
  { rule: "connection_string", regex: /(?:mongodb|postgres):\/\/[^\s]+/gi },
];

const WHITELIST_FILES = [
  "docs/contributor-playbook.md",
  "docs/maintainer-playbook.md",
  "docs/runbooks.md",
  "docs/architecture.md",
  "scripts/secret-scan.ts",
  "scripts/secret-scan-staged.ts",
  "apps/api/src/lib/audit.service.test.ts",
  "apps/api/src/modules/fixture-manifest/fixture-manifest.contract.test.ts",
  "apps/api/src/modules/health/notifications.spec.ts",
  "apps/api/src/modules/security/services/redaction.service.test.ts",
];

const ROOT = process.cwd();
const files = process.argv.slice(2);

if (files.length === 0) {
  console.log("No staged files to scan.");
  process.exit(0);
}

const findings: Array<{ file: string; line: number; rule: string; sample: string }> = [];

for (const file of files) {
  const abs = path.resolve(ROOT, file);
  const rel = path.relative(ROOT, abs).replace(/\\/g, "/");

  if (WHITELIST_FILES.includes(rel)) continue;
  if (!fs.existsSync(abs)) continue;

  const stat = fs.statSync(abs);
  if (!stat.isFile()) continue;

  const content = fs.readFileSync(abs, "utf8");
  const lines = content.split(/\r?\n/);

  for (const [idx, line] of lines.entries()) {
    for (const pattern of PATTERNS) {
      const match = line.match(pattern.regex);
      if (match) {
        findings.push({ file: rel, line: idx + 1, rule: pattern.rule, sample: match[0].slice(0, 48) });
      }
    }
  }
}

for (const finding of findings) {
  console.error(`${finding.file}:${finding.line} [${finding.rule}] ${finding.sample}`);
}

if (findings.length > 0) {
  console.error(`\nCommit blocked: ${findings.length} potential secret(s) found in staged files.`);
  console.error("Remove the secrets or add the file to the whitelist in scripts/secret-scan-staged.ts.");
  process.exit(1);
}

console.log(`Secret scan passed: ${files.length} staged file(s) checked.`);
