/**
 * BE-004: Shared runtime configuration model.
 *
 * Validates environment variables per boundary (server, rpc, contracts, features).
 * Supports three bootstrap modes:
 *   - local  — full dev stack, all RPC endpoints expected
 *   - demo   — hosted demo, mainnet optional, fixtures optional
 *   - ci     — test runner, database required, RPC endpoints optional
 *
 * Missing required vars fail fast with actionable diagnostics.
 * Missing optional vars get defaults and emit a warning.
 */

export type RuntimeMode = "local" | "demo" | "ci";

function detectMode(): RuntimeMode {
  const m = process.env["RUNTIME_MODE"];
  if (m === "demo" || m === "ci" || m === "local") return m;
  if (process.env["CI"] === "true" || process.env["CI"] === "1") return "ci";
  return "local";
}

// ── Per-boundary variable definitions ────────────────────────────────────────

const SERVER_REQUIRED: string[] = ["DATABASE_URL", "WEB_ORIGIN", "PORT"];

const RPC_DEFAULTS: Record<string, string> = {
  SOROBAN_RPC_TESTNET_URL: "https://soroban-testnet.stellar.org:443",
  SOROBAN_RPC_FUTURENET_URL: "https://rpc-futurenet.stellar.org:443",
  SOROBAN_RPC_LOCAL_URL: "http://localhost:8000/soroban/rpc",
};

/** RPC vars required in local mode (demo/ci treat them as optional). */
const RPC_REQUIRED_IN_LOCAL: string[] = Object.keys(RPC_DEFAULTS);

const CONTRACT_FIXTURE_VARS: string[] = [
  "CONTRACT_COUNTER_FIXTURE",
  "CONTRACT_TOKEN_FIXTURE",
  "CONTRACT_EVENT_FIXTURE",
  "CONTRACT_FAILURE_FIXTURE",
  "CONTRACT_TYPES_TESTER",
  "CONTRACT_AUTH_TESTER",
  "CONTRACT_SOURCE_REGISTRY",
  "CONTRACT_ERROR_TRIGGER",
];

// ── Validation ────────────────────────────────────────────────────────────────

function assertPresent(vars: string[], boundary: string): void {
  const missing = vars.filter((k) => !process.env[k]);
  if (missing.length > 0) {
    throw new Error(
      `[env:${boundary}] Missing required environment variables:\n` +
        missing.map((k) => `  - ${k}`).join("\n") +
        `\n\nCopy apps/api/.env.example to apps/api/.env and fill in the values.`,
    );
  }
}

function applyDefaults(defaults: Record<string, string>): void {
  for (const [key, fallback] of Object.entries(defaults)) {
    if (!process.env[key]) {
      process.env[key] = fallback;
      console.warn(`[env] ${key} not set — using default: ${fallback}`);
    }
  }
}

function warnMissing(vars: string[], boundary: string): void {
  for (const key of vars) {
    if (!process.env[key]) {
      console.warn(`[env:${boundary}] ${key} is not set — related features will be unavailable.`);
    }
  }
}

// ── Public entry point ────────────────────────────────────────────────────────

export function validateEnv(): void {
  const mode = detectMode();
  console.info(`[env] Runtime mode: ${mode}`);

  // Server boundary — always required
  assertPresent(SERVER_REQUIRED, "server");

  // RPC boundary
  if (mode === "local") {
    // In local mode apply defaults for missing optional RPC vars, then warn about mainnet
    applyDefaults(RPC_DEFAULTS);
    if (!process.env["SOROBAN_RPC_MAINNET_URL"]) {
      console.warn("[env:rpc] SOROBAN_RPC_MAINNET_URL is not set — mainnet RPC calls will fail.");
    }
  } else {
    // demo / ci: apply defaults silently, warn about any still-missing RPC vars
    applyDefaults(RPC_DEFAULTS);
    warnMissing([...RPC_REQUIRED_IN_LOCAL, "SOROBAN_RPC_MAINNET_URL"], "rpc");
  }

  // Contract fixtures — only required in local mode
  if (mode === "local") {
    warnMissing(CONTRACT_FIXTURE_VARS, "contracts");
  }

  // Feature flags — always optional, no warning needed (defaults to enabled)
}
