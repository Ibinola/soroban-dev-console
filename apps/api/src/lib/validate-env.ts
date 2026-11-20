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
 * Issue #1149: Presence AND format validation for the critical variables, a
 * formatted error diagnostic table, and a clean exit code 1 on failure.
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

/** Issue #1149: canonical RPC env keys whose URL format is validated. */
const RPC_URL_VARS: string[] = [...Object.keys(RPC_DEFAULTS), "RPC_ENDPOINTS_MAINNET"];

/**
 * Issue #1149: alias named in the issue. The repo's canonical key is
 * RPC_ENDPOINTS_TESTNET; SOROBAN_RPC_TESTNET_URL is validated the same way
 * whenever it is set by an operator.
 */
const SOROBAN_RPC_TESTNET_URL_ALIAS = "SOROBAN_RPC_TESTNET_URL";

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

// ── Format validation (Issue #1149) ──────────────────────────────────────────

export function isValidDatabaseUrl(value: string | undefined): boolean {
  if (!value) return false;
  const trimmed = value.trim();
  return (
    /^file:.+\.db(pp)?$/i.test(trimmed) || /^postgres(ql)?:\/\/.+/.test(trimmed)
  );
}

export function isValidHttpUrl(value: string | undefined): boolean {
  if (!value) return false;
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

export interface EnvDiagnostic {
  variable: string;
  boundary: string;
  status: "missing" | "invalid";
  message?: string;
}

/**
 * Pure analyzer (side-effect free) that validates presence and format of the
 * critical environment variables without touching process.env. Optional RPC
 * vars are only flagged when present-but-invalid; absence is a warning handled
 * by the boot path.
 */
export function analyzeEnv(
  env: Record<string, string | undefined>,
): EnvDiagnostic[] {
  const diagnostics: EnvDiagnostic[] = [];

  for (const key of SERVER_REQUIRED) {
    const value = env[key];
    if (!value) {
      diagnostics.push({
        variable: key,
        boundary: "server",
        status: "missing",
        message: "is required",
      });
      continue;
    }
    if (key === "DATABASE_URL" && !isValidDatabaseUrl(value)) {
      diagnostics.push({
        variable: key,
        boundary: "server",
        status: "invalid",
        message: "must be a sqlite file path (file:*.db) or a postgres:// URL",
      });
    }
  }

  const rpcVars = [...RPC_URL_VARS];
  if (env[SOROBAN_RPC_TESTNET_URL_ALIAS] !== undefined) {
    rpcVars.push(SOROBAN_RPC_TESTNET_URL_ALIAS);
  }

  for (const key of rpcVars) {
    const value = env[key];
    if (!value) continue; // optional — absence is handled by defaults/warnings
    if (!isValidHttpUrl(value)) {
      diagnostics.push({
        variable: key,
        boundary: "rpc",
        status: "invalid",
        message: "must be an absolute http(s) URL",
      });
    }
  }

  return diagnostics;
}

// ── Diagnostic table (Issue #1149) ───────────────────────────────────────────

function padEnd(text: string, width: number): string {
  return text.length >= width ? text : text + " ".repeat(width - text.length);
}

export function formatEnvDiagnosticsTable(diagnostics: EnvDiagnostic[]): string {
  const rows = diagnostics.map((d) => ({
    variable: d.variable,
    status: d.status,
    detail: d.message ?? "",
  }));

  const widthVariable = Math.max(30, ...rows.map((r) => r.variable.length));
  const widthStatus = 7;
  const widthDetail = Math.max(20, ...rows.map((r) => r.detail.length));

  const header = `${padEnd("Variable", widthVariable)} | ${padEnd("Status", widthStatus)} | ${padEnd("Detail", widthDetail)}`;
  const rule = `${"-".repeat(widthVariable)} | ${"-".repeat(widthStatus)} | ${"-".repeat(widthDetail)}`;

  const body = rows.map(
    (row) =>
      `${padEnd(row.variable, widthVariable)} | ${padEnd(row.status, widthStatus)} | ${padEnd(row.detail, widthDetail)}`,
  );

  return [header, rule, ...body].join("\n");
}

// ── Validation ────────────────────────────────────────────────────────────────

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

/**
 * Validate the runtime environment. On missing/invalid critical variables it
 * prints a formatted diagnostic table to stderr and throws, so the process
 * terminates cleanly with exit code 1 before NestJS module init.
 */
export function validateEnv(): void {
  const mode = detectMode();
  structuredInfo(`[env] Runtime mode: ${mode}`);

  // Issue #754: LOG_LEVEL defaults to info, set to warn in production
  if (!process.env["LOG_LEVEL"]) {
    process.env["LOG_LEVEL"] = "info";
    structuredInfo("[env] LOG_LEVEL not set — defaulting to 'info'");
  }

  // Issue #1149: presence + format analysis BEFORE any defaults are applied,
  // so a missing DATABASE_URL is reported as "missing" rather than silently
  // defaulted. RPC defaults below do not touch DATABASE_URL / WEB_ORIGIN.
  const diagnostics = analyzeEnv(process.env as Record<string, string | undefined>);
  const failures = diagnostics.filter(
    (d) => d.status === "missing" || d.status === "invalid",
  );
  if (failures.length > 0) {
    console.error("\n[env] Critical environment variable validation failed:\n");
    console.error(formatEnvDiagnosticsTable(failures));
    throw new Error(
      `[env] ${failures.length} critical environment variable(s) invalid. See diagnostic table above.`,
    );
  }

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