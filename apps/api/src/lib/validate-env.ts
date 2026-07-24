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
 *
 * Issue #754: Uses structured logger instead of console.warn/info.
 * Issue #753: LOG_LEVEL configures verbosity (default: info, production: warn).
 * Issue #752: WEBHOOK_TARGET_URL and WEBHOOK_SECRET validated here.
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
  RPC_ENDPOINTS_TESTNET: "https://soroban-testnet.stellar.org:443",
  RPC_ENDPOINTS_FUTURENET: "https://rpc-futurenet.stellar.org:443",
  RPC_ENDPOINTS_LOCAL: "http://localhost:8000/soroban/rpc",
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
      structuredWarn(`[env] ${key} not set — using default: ${fallback}`);
    }
  }
}

function warnMissing(vars: string[], boundary: string): void {
  for (const key of vars) {
    if (!process.env[key]) {
      structuredWarn(`[env:${boundary}] ${key} is not set — related features will be unavailable.`);
    }
  }
}

/**
 * Emit a structured warning log. Used here before the logger module is
 * fully initialised, so we write directly to stderr as JSON.
 */
function structuredWarn(message: string): void {
  const entry = JSON.stringify({
    level: "warn",
    timestamp: new Date().toISOString(),
    context: "EnvValidation",
    correlationId: "system",
    message,
  });
  console.warn(entry);
}

function structuredInfo(message: string): void {
  const entry = JSON.stringify({
    level: "info",
    timestamp: new Date().toISOString(),
    context: "EnvValidation",
    correlationId: "system",
    message,
  });
  console.log(entry);
}

// ── Public entry point ────────────────────────────────────────────────────────

export function validateEnv(): void {
  const mode = detectMode();
  structuredInfo(`[env] Runtime mode: ${mode}`);

  // Issue #754: LOG_LEVEL defaults to info, set to warn in production
  if (!process.env["LOG_LEVEL"]) {
    process.env["LOG_LEVEL"] = "info";
    structuredInfo("[env] LOG_LEVEL not set — defaulting to 'info'");
  }

  // Server boundary — always required
  assertPresent(SERVER_REQUIRED, "server");

  // RPC boundary
  if (mode === "local") {
    // In local mode apply defaults for missing optional RPC vars, then warn about mainnet
    applyDefaults(RPC_DEFAULTS);
    if (!process.env["RPC_ENDPOINTS_MAINNET"]) {
      structuredWarn("[env:rpc] RPC_ENDPOINTS_MAINNET is not set — mainnet RPC calls will fail.");
    }
  } else {
    // demo / ci: apply defaults silently, warn about any still-missing RPC vars
    applyDefaults(RPC_DEFAULTS);
    warnMissing([...RPC_REQUIRED_IN_LOCAL, "RPC_ENDPOINTS_MAINNET"], "rpc");
  }

  // Contract fixtures — only required in local mode
  if (mode === "local") {
    warnMissing(CONTRACT_FIXTURE_VARS, "contracts");
  }

  // Issue #752: Webhook delivery — optional, silently skip if not configured
  if (!process.env["WEBHOOK_TARGET_URL"]) {
    structuredInfo("[env:webhooks] WEBHOOK_TARGET_URL is not set — outbound webhook delivery disabled.");
  } else if (!process.env["WEBHOOK_SECRET"]) {
    structuredWarn("[env:webhooks] WEBHOOK_SECRET is not set — webhook payloads will not be signed.");
  }

  // Feature flags — always optional, no warning needed (defaults to enabled)
}
