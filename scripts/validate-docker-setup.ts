#!/usr/bin/env tsx
/**
 * validate-docker-setup.ts
 *
 * Issue #1143: Pre-flight checks for launching the DevConsole via Docker
 * Compose. Verifies:
 *   - host port availability (3000 web / 4000 api / 8000 horizon) before the
 *     containers try to bind them,
 *   - presence of a valid `.env` with the required RPC environment keys,
 *   - that a SQLite volume mount (`.db`) actually exists in docker-compose,
 *     so the classic "missing container volume" startup failure is caught
 *     before the stack boots.
 *
 * All core logic is exported as pure functions so it can be unit-tested
 * without a docker daemon: `npx tsx --test scripts/validate-docker-setup.test.ts`
 */

import { existsSync, readFileSync } from "fs";
import { resolve } from "path";
import { createServer } from "net";
import { fileURLToPath, pathToFileURL } from "url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const ROOT = resolve(__dirname, "..");

// Mirrors packages/api-contracts/src/runtime-defaults.ts.
export const DEFAULT_DOCKER_PORTS = [3000, 4000, 8000];

/** API server vars required for boot (see apps/api/src/lib/validate-env.ts). */
export const REQUIRED_SERVER_KEYS = ["DATABASE_URL", "WEB_ORIGIN", "PORT"];

/** RPC endpoint vars expected in local development (.env.example). */
export const REQUIRED_RPC_KEYS = [
  "RPC_ENDPOINTS_TESTNET",
  "RPC_ENDPOINTS_FUTURENET",
  "RPC_ENDPOINTS_LOCAL",
];

export interface EnvDiagnostic {
  key: string;
  present: boolean;
  /** Set on RPC/URL keys: value parses as an absolute http(s) URL. */
  validUrl?: boolean;
}

export interface SetupCheck {
  category: "ports" | "env" | "volume";
  status: "ok" | "warn" | "fail";
  message: string;
}

/** Bind a server to the port to test availability; resolves hosted-ness. */
export function probePort(port: number): Promise<{ port: number; available: boolean }> {
  return new Promise((resolvePromise) => {
    const server = createServer();
    server.once("error", () => {
      server.close(() => resolvePromise({ port, available: false }));
    });
    server.listen({ host: "0.0.0.0", port }, () => {
      server.close(() => resolvePromise({ port, available: true }));
    });
  });
}

export async function checkPorts(
  ports: number[],
  probe: (port: number) => Promise<{ port: number; available: boolean }> = probePort,
): Promise<SetupCheck[]> {
  const results = await Promise.all(ports.map((port) => probe(port)));
  return results.map(({ port, available }) => ({
    category: "ports",
    status: available ? "ok" : "fail",
    message: available
      ? `Port ${port} is free`
      : `Port ${port} is already in use — stop the conflicting process or change the port mapping`,
  }));
}

/** Parse a `.env` file into key/value pairs (comments and blanks ignored). */
export function parseEnv(fileText: string): Record<string, string> {
  const vars: Record<string, string> = {};
  for (const line of fileText.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const equalsAt = trimmed.indexOf("=");
    if (equalsAt <= 0) continue;
    const key = trimmed.slice(0, equalsAt).trim();
    const value = trimmed.slice(equalsAt + 1).trim();
    if (key) vars[key] = value;
  }
  return vars;
}

export function isValidHttpUrl(value: string): boolean {
  if (!value) return false;
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

export function collectEnvDiagnostics(
  env: Record<string, string>,
  serverKeys: string[] = REQUIRED_SERVER_KEYS,
  rpcKeys: string[] = REQUIRED_RPC_KEYS,
): EnvDiagnostic[] {
  const diagnostics: EnvDiagnostic[] = [];
  for (const key of serverKeys) {
    diagnostics.push({ key, present: Boolean(env[key]) });
  }
  for (const key of rpcKeys) {
    const value = env[key];
    diagnostics.push({ key, present: Boolean(value), validUrl: value ? isValidHttpUrl(value) : false });
  }
  return diagnostics;
}

export function envChecksToSetupChecks(diagnostics: EnvDiagnostic[]): SetupCheck[] {
  return diagnostics.map((diag) => {
    const failed = !diag.present || (diag.validUrl !== undefined && !diag.validUrl);
    return {
      category: "env",
      status: failed ? "fail" : "ok",
      message: failed
        ? `Missing or invalid ${diag.key}${diag.present ? " — must be an absolute http(s) URL" : " in apps/api/.env"}`
        : `${diag.key} is present`,
    };
  });
}

/** Detect SQLite volume mounts in a docker-compose file (heuristic). */
export function scanSqliteVolumes(composeText: string): SetupCheck[] {
  const checks: SetupCheck[] = [];
  const hasDbMount = /\.db\b/i.test(composeText) || /(\/\w+\/)?(soroban|rpc)-?\w*\.db\b/i.test(composeText);
  const hasVolumesSection = /^\s*volumes:/m.test(composeText);

  if (!hasVolumesSection) {
    checks.push({
      category: "volume",
      status: "fail",
      message: "docker-compose has no top-level 'volumes:' section — data will be lost on container removal",
    });
  } else if (!hasDbMount) {
    checks.push({
      category: "volume",
      status: "fail",
      message: "No SQLite volume mount (.db) found — add a named volume mapping to apps/api/.data or the RPC db file",
    });
  } else {
    checks.push({
      category: "volume",
      status: "ok",
      message: "SQLite volume mount detected",
    });
  }
  return checks;
}

export const TROUBLESHOOTING_GUIDANCE = `Troubleshooting tips:
  1. Copy the example env files and fill in real values:
       cp apps/api/.env.example apps/api/.env
       cp apps/web/.env.example apps/web/.env
  2. Stop any process already listening on ports 3000 / 4000 / 8000:
       lsof -i :3000 -i :4000 -i :8000
  3. Confirm docker-compose declares a persistent SQLite volume for the RPC
     node and the API db (something like ./data:/var/lib/... or *.db mounts).
  4. Re-run this check, then start the stack:
       npx tsx scripts/validate-docker-setup.ts
       docker compose up
`;

export function formatChecks(checks: SetupCheck[]): string {
  const lines = checks.map((check) => {
    const tag = check.status === "ok" ? "OK  " : check.status === "warn" ? "WARN" : "FAIL";
    return `  [${tag}] ${check.message}`;
  });
  return lines.join("\n");
}

async function main(): Promise<void> {
  console.log("\nSoroban DevConsole — Docker setup pre-flight checks\n");
  const checks: SetupCheck[] = [];

  try {
    checks.push(...(await checkPorts(DEFAULT_DOCKER_PORTS)));
  } catch (err) {
    checks.push({ category: "ports", status: "fail", message: `Port probe failed: ${String(err)}` });
  }

  // Locate a real env file (root .env, then scoped api/web .env).
  let envText: string | undefined;
  const candidates = [".env", "apps/api/.env", "apps/web/.env"];
  for (const candidate of candidates) {
    const full = resolve(ROOT, candidate);
    if (existsSync(full)) {
      envText = readFileSync(full, "utf-8");
      break;
    }
  }

  if (envText === undefined) {
    checks.push({
      category: "env",
      status: "fail",
      message: "No .env file found — copy apps/api/.env.example and apps/web/.env.example into place",
    });
  } else {
    checks.push(...envChecksToSetupChecks(collectEnvDiagnostics(parseEnv(envText))));
  }

  const composeCandidates = ["docker-compose.yml", "docker-compose.yaml", "compose.yml", "compose.yaml"];
  let composeFound = false;
  for (const candidate of composeCandidates) {
    const full = resolve(ROOT, candidate);
    if (existsSync(full)) {
      composeFound = true;
      checks.push(...scanSqliteVolumes(readFileSync(full, "utf-8")));
      break;
    }
  }
  if (!composeFound) {
    checks.push({
      category: "volume",
      status: "warn",
      message: "No docker-compose file found — skipping volume-mount checks (running natively?)",
    });
  }

  console.log(formatChecks(checks));

  const failed = checks.filter((check) => check.status === "fail");
  if (failed.length > 0) {
    console.error(`\n${failed.length} pre-flight check(s) failed.\n`);
    console.error(TROUBLESHOOTING_GUIDANCE);
    process.exitCode = 1;
    return;
  }
  console.log("\nAll checks passed — safe to run 'docker compose up'.");
}

function isDirectRun(): boolean {
  if (process.argv[1] === undefined) return false;
  try {
    return pathToFileURL(process.argv[1]).href === import.meta.url;
  } catch {
    return false;
  }
}

if (isDirectRun()) {
  void main();
}

export { main, ROOT };