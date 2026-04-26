import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

/**
 * DEVOPS-025: Automated drift check for runtime ports and URLs.
 * Ensures that documented defaults and env.example files stay aligned
 * with the canonical source of truth in packages/api-contracts.
 */

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, "..");

// ── Source of Truth ──────────────────────────────────────────────────────────

// We read the file directly to avoid complex monorepo import issues in a standalone script
const DEFAULTS_FILE = path.join(ROOT, "packages/api-contracts/src/runtime-defaults.ts");
const defaultsContent = fs.readFileSync(DEFAULTS_FILE, "utf-8");

const getConst = (name: string) => {
  const match = defaultsContent.match(new RegExp(`export const ${name} = (?:(?:"|'|\`)(.*?)(?:"|'|\`)|(\\d+))`));
  return match ? (match[1] || match[2]) : null;
};

const API_PORT = getConst("DEFAULT_API_PORT");
const WEB_PORT = getConst("DEFAULT_WEB_PORT");
const HORIZON_PORT = getConst("DEFAULT_HORIZON_PORT");

if (!API_PORT || !WEB_PORT || !HORIZON_PORT) {
  console.error("❌ Failed to parse constants from runtime-defaults.ts");
  process.exit(1);
}

console.log(`🔍 Source of Truth: API=${API_PORT}, WEB=${WEB_PORT}, HORIZON=${HORIZON_PORT}`);

let errors = 0;

function check(file: string, regex: RegExp, expected: string, label: string) {
  const fullPath = path.join(ROOT, file);
  if (!fs.existsSync(fullPath)) {
    console.warn(`⚠️  File not found: ${file}`);
    return;
  }
  const content = fs.readFileSync(fullPath, "utf-8");
  const match = content.match(regex);
  if (!match || (match[1] !== expected && match[2] !== expected)) {
    console.error(`❌ Drift detected in ${file} (${label})`);
    console.error(`   Expected: ${expected}`);
    console.error(`   Found:    ${match ? (match[1] || match[2]) : "no match"}`);
    errors++;
  } else {
    console.log(`✅ ${file} (${label}) aligned`);
  }
}

// ── Validations ──────────────────────────────────────────────────────────────

// apps/api/.env.example
check("apps/api/.env.example", /^PORT="(\d+)"/m, API_PORT, "PORT");
check("apps/api/.env.example", /^WEB_ORIGIN="http:\/\/localhost:(\d+)"/m, WEB_PORT, "WEB_ORIGIN");

// apps/web/.env.example
check("apps/web/.env.example", /^NEXT_PUBLIC_API_URL="http:\/\/localhost:(\d+)"/m, API_PORT, "API_URL");

// README.md
check("README.md", /API \(port (\d+)\)/, API_PORT, "API port mention");
check("README.md", /web app \(port (\d+)\)/, WEB_PORT, "Web port mention");

// docs/architecture.md
check("docs/architecture.md", /apps\/api \(NestJS, port (\d+)\)/, API_PORT, "API port mention");
check("docs/architecture.md", /apps\/web \(Next.js, port (\d+)\)/, WEB_PORT, "Web port mention");

if (errors > 0) {
  console.error(`\n💥 Total drifts found: ${errors}`);
  process.exit(1);
}

console.log("\n✨ All runtime defaults are aligned.");
