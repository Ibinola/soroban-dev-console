import { execSync } from "child_process";

const checks: Array<{ label: string; cmd: string }> = [
  { label: "Node >= 18", cmd: 'node -e "process.exit(parseInt(process.version.slice(1))>=18?0:1)"' },
  { label: "npm installed", cmd: "npm --version" },
  { label: "Git user configured", cmd: "git config user.email" },
  { label: "Web .env.example exists", cmd: "node -e "require('fs').accessSync('apps/web/.env.example')"" },
  { label: "API .env.example exists", cmd: "node -e "require('fs').accessSync('apps/api/.env.example')"" },
];

let passed = 0;
for (const check of checks) {
  try {
    execSync(check.cmd, { stdio: "ignore" });
    console.log(`  [OK]   ${check.label}`);
    passed++;
  } catch {
    console.error(`  [FAIL] ${check.label}`);
  }
}

console.log(`\nPreflight: ${passed}/${checks.length} checks passed.`);
if (passed < checks.length) process.exit(1);
