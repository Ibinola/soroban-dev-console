import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const ROOT = process.cwd();
const PATTERNS = [
  { rule: "email", regex: /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi },
  { rule: "jwt", regex: /eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g },
  { rule: "stellar_secret", regex: /S[A-Z2-7]{55}/g },
  { rule: "long_hex_secret", regex: /\b[a-f0-9]{64,}\b/gi },
  { rule: "aws_access_key", regex: /\bAKIA[0-9A-Z]{16}\b/g },
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
  "scripts/secret-scan.ts",
  "scripts/secret-scan-staged.ts",
];

function isTextFile(file: string): boolean {
  return /\.(ts|tsx|js|jsx|json|md|yml|yaml|sh|txt|toml|rs|sql|prisma|env|cjs|mjs)$/i.test(file);
}

// Get files from arguments (for staged file scanning) or scan all
const args = process.argv.slice(2);
const files: string[] = args
  .filter(f => {
    if (!isTextFile(f) || !fs.existsSync(f)) return false;
    // Skip node_modules, dist, test files, and package lock files
    if (f.includes("node_modules") || f.includes("/dist/") || f.includes("\\dist\\")) return false;
    if (f.includes(".test.ts") || f.includes(".test.tsx") || f.includes(".test.js")) return false;
    if (f.includes(".spec.ts") || f.includes(".spec.tsx") || f.includes(".spec.js")) return false;
    if (f.includes("package-lock.json") || f.includes("yarn.lock")) return false;
    return true;
  });

if (files.length === 0 && args.length > 0) {
  console.log("No scannable files in the provided list.");
  process.exit(0);
}

const findings: Array<{ file: string; line: number; rule: string; sample: string }> = [];
for (const file of files) {
  const rel = path.relative(ROOT, file).replace(/\\/g, "/");
  if (WHITELIST_FILES.includes(rel)) continue;
  
  const lines = fs.readFileSync(file, "utf8").split(/\r?\n/);
  for (const [idx, line] of lines.entries()) {
    for (const pattern of PATTERNS) {
      const match = line.match(pattern.regex);
      if (match) findings.push({ file, line: idx + 1, rule: pattern.rule, sample: match[0].slice(0, 48) });
    }
  }
}

let foundSecret = false;
for (const finding of findings) {
  const rel = path.relative(ROOT, finding.file).replace(/\\/g, "/");
  console.error(`${rel}:${finding.line} [${finding.rule}] ${finding.sample}`);
  foundSecret = true;
}

if (foundSecret) {
  console.error(`\nSecret scan FAILED: ${findings.length} potential secrets found.`);
  console.error("Remove secrets before committing or add to .gitignore.");
  process.exit(1);
}

console.log(`Secret scan passed: ${files.length} files checked with ${PATTERNS.length} patterns.`);
