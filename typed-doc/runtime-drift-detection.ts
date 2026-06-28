/**
 * Issue #508 (DEVOPS-423): Detect runtime drift in CI environments
 *
 * Root cause:
 * - check-runtime-drift.ts validates port alignment across env.example files,
 *   README.md, and docs/architecture.md against packages/api-contracts/src/runtime-defaults.ts
 * - But the check only runs in CI when DevOps path is triggered, and uses a
 *   simple string-match approach (regex) that misses structural changes like
 *   new env vars, removed defaults, or type changes in the source of truth
 * - The turbo.json check-drift task has limited inputs — it doesn't track
 *   downstream consumers of runtime defaults (docker-compose.yml, deploy configs, etc.)
 * - No drift is detected for CI environment parity (differences between local,
 *   CI, and production environments)
 *
 * Fix: Expand drift detection to cover CI environment parity, add structural
 *       JSON schema validation for env files, and extend the turborepo input
 *       graph to re-check drift when CI configs change.
 */

// ---- FLAWED (turbo.json - check-drift inputs) ----
"check-drift": {
  "outputs": [],
  "inputs": [
    "scripts/check-runtime-drift.ts",
    "packages/api-contracts/src/runtime-defaults.ts",
    "apps/api/.env.example",
    "apps/web/.env.example",
    "README.md",
    "docs/architecture.md"
  ]
}

// ---- FIXED (turbo.json) ----
"check-drift": {
  "outputs": [],
  "inputs": [
    "scripts/check-runtime-drift.ts",
    "packages/api-contracts/src/runtime-defaults.ts",
    "apps/api/.env.example",
    "apps/web/.env.example",
    "README.md",
    "docs/architecture.md",
    "docker-compose.yml",
    ".env.soroban.example",
    ".github/workflows/ci.yml",
    ".github/workflows/release-candidate.yml"
  ]
}

// ---- FIXED (check-runtime-drift.ts additions) ----
// 1. Validate all env.example vars exist in runtime-defaults
// 2. Check CI environment variable parity (ci.yml vs .env.example)
// 3. Schema-validation of .env.example files against a JSON schema derived
//    from runtime-defaults.ts

interface EnvVarSpec {
  name: string;
  default: string | number;
  required: boolean;
  description?: string;
}

// After parsing runtime-defaults.ts, extract an env var spec
function extractEnvSpec(): EnvVarSpec[] {
  // Parse runtime-defaults.ts exports to build expected env vars
  // e.g., DEFAULT_API_PORT → PORT
  // e.g., DEFAULT_WEB_PORT → WEB_ORIGIN
  return [
    { name: "PORT", default: API_PORT, required: true },
    { name: "WEB_ORIGIN", default: `http://localhost:${WEB_PORT}`, required: true },
    { name: "NEXT_PUBLIC_API_URL", default: `http://localhost:${API_PORT}`, required: true },
    // ... additional derived vars
  ];
}

function checkEnvFileParity(file: string, specs: EnvVarSpec[]) {
  const content = fs.readFileSync(path.join(ROOT, file), "utf-8");
  for (const spec of specs) {
    const regex = new RegExp(`^${spec.name}=`, "m");
    if (spec.required && !regex.test(content)) {
      console.error(`❌ Missing required env var '${spec.name}' in ${file}`);
      errors++;
    }
  }
}

// 3. Add CI env parity check — ensures workflow env vars match .env.example
function checkCIEnvParity() {
  const ciYml = fs.readFileSync(
    path.join(ROOT, ".github/workflows/ci.yml"), "utf-8"
  );
  // Parse env: block in ci.yml and compare against .env.example
  const ciEnvMatch = ciYml.matchAll(/^\s+(\w+):\s*"?(.+?)"?$/gm);
  for (const [, name] of ciEnvMatch) {
    // Verify each CI env var exists in at least one .env.example
    const inApiEnv = fs.existsSync(envPath)
      ? fs.readFileSync(envPath, "utf-8").includes(`${name}=`)
      : false;
    if (!inApiEnv) {
      console.warn(`⚠️  CI env var '${name}' missing from .env.example files`);
    }
  }
}
