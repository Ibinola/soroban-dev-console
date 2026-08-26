#!/usr/bin/env tsx
/**
 * check-security-vulnerabilities.ts
 *
 * Issue #942: Automated dependency security audit script and vulnerability scanner.
 *
 * Runs `npm audit` and optionally Snyk against all workspace packages.
 * Exits non-zero if any HIGH or CRITICAL severity CVEs are detected so that
 * CI builds are blocked before a vulnerable dependency is merged.
 *
 * Usage
 * -----
 *   # Run from repo root
 *   npx tsx scripts/check-security-vulnerabilities.ts
 *
 *   # Include Snyk scan (requires SNYK_TOKEN env var or `snyk auth`)
 *   SNYK_TOKEN=<token> npx tsx scripts/check-security-vulnerabilities.ts --snyk
 *
 * Exit codes
 * ----------
 *   0  All checks passed (zero high/critical CVEs)
 *   1  One or more high/critical CVEs detected, or the audit could not run
 *
 * CI Integration
 * ---------------
 * Add to `.github/workflows/ci.yml`:
 *
 *   - name: Security audit
 *     run: npx tsx scripts/check-security-vulnerabilities.ts
 */

import { execSync, spawnSync } from "child_process";
import { existsSync, writeFileSync, mkdirSync } from "fs";
import { resolve, join } from "path";

// ─── Configuration ────────────────────────────────────────────────────────────

const ROOT = resolve(__dirname, "..");
const REPORT_DIR = join(ROOT, "security-reports");
const REPORT_FILE = join(REPORT_DIR, `audit-${new Date().toISOString().replace(/[:.]/g, "-")}.json`);
const ARGS = process.argv.slice(2);
const RUN_SNYK = ARGS.includes("--snyk");

// Severity levels that should fail the build
const FAIL_SEVERITIES = new Set(["high", "critical"]);

// ─── Types ────────────────────────────────────────────────────────────────────

interface NpmAuditVulnerabilities {
  info?: number;
  low?: number;
  moderate?: number;
  high?: number;
  critical?: number;
  total?: number;
}

interface NpmAuditReport {
  metadata?: {
    vulnerabilities?: NpmAuditVulnerabilities;
    totalDependencies?: number;
  };
  vulnerabilities?: Record<string, {
    name: string;
    severity: string;
    isDirect: boolean;
    via: unknown[];
    fixAvailable: boolean | { name: string; version: string; isSemVerMajor: boolean };
  }>;
}

interface SecuritySummary {
  timestamp: string;
  passed: boolean;
  checks: {
    npmAudit: AuditCheckResult;
    snyk?: AuditCheckResult;
  };
  vulnerabilities: VulnerabilityEntry[];
  totalDependencies?: number;
}

interface AuditCheckResult {
  ran: boolean;
  passed: boolean;
  counts: Record<string, number>;
  error?: string;
}

interface VulnerabilityEntry {
  name: string;
  severity: string;
  isDirect: boolean;
  fixAvailable: boolean;
  fixVersion?: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function log(msg: string) {
  process.stdout.write(msg + "\n");
}

function warn(msg: string) {
  process.stderr.write(`⚠️  ${msg}\n`);
}

function error(msg: string) {
  process.stderr.write(`❌  ${msg}\n`);
}

function ok(msg: string) {
  log(`✅  ${msg}`);
}

function heading(msg: string) {
  log(`\n${"─".repeat(60)}\n${msg}\n${"─".repeat(60)}`);
}

function ensureReportDir() {
  if (!existsSync(REPORT_DIR)) {
    mkdirSync(REPORT_DIR, { recursive: true });
  }
}

// ─── npm audit ────────────────────────────────────────────────────────────────

function runNpmAudit(): AuditCheckResult & {
  vulns: VulnerabilityEntry[];
  totalDependencies?: number;
} {
  heading("npm audit — dependency vulnerability scan");

  let rawOutput = "";
  let exitCode = 0;

  try {
    rawOutput = execSync("npm audit --json", {
      cwd: ROOT,
      stdio: "pipe",
      encoding: "utf-8",
    });
  } catch (err: any) {
    // npm audit exits non-zero when it finds vulnerabilities
    rawOutput = (err.stdout as string) ?? "";
    exitCode = err.status ?? 1;
    void exitCode;
  }

  let report: NpmAuditReport = {};
  try {
    report = JSON.parse(rawOutput) as NpmAuditReport;
  } catch {
    warn("Could not parse npm audit JSON output. Run `npm audit` manually.");
    return {
      ran: false,
      passed: false,
      counts: {},
      error: "JSON parse failure",
      vulns: [],
    };
  }

  const counts = report.metadata?.vulnerabilities ?? {};
  const totalDependencies = report.metadata?.totalDependencies;

  // Print summary table
  log("");
  log("  Severity     Count");
  log("  ──────────── ─────");
  for (const severity of ["info", "low", "moderate", "high", "critical"]) {
    const count = (counts as any)[severity] ?? 0;
    const flag = FAIL_SEVERITIES.has(severity) && count > 0 ? " ⚑" : "";
    log(`  ${severity.padEnd(12)} ${String(count).padStart(5)}${flag}`);
  }
  log("");

  if (typeof totalDependencies === "number") {
    log(`  Total audited packages: ${totalDependencies}`);
  }

  // Collect individual vulnerability details
  const vulns: VulnerabilityEntry[] = [];
  for (const [, vuln] of Object.entries(report.vulnerabilities ?? {})) {
    const fixAvailableRaw = vuln.fixAvailable;
    const fixAvailable = fixAvailableRaw !== false;
    const fixVersion =
      typeof fixAvailableRaw === "object" && fixAvailableRaw !== null
        ? fixAvailableRaw.version
        : undefined;

    vulns.push({
      name: vuln.name,
      severity: vuln.severity,
      isDirect: vuln.isDirect,
      fixAvailable,
      fixVersion,
    });
  }

  // Print HIGH and CRITICAL details
  const blocking = vulns.filter((v) => FAIL_SEVERITIES.has(v.severity));
  if (blocking.length > 0) {
    log("  Blocking vulnerabilities:");
    for (const v of blocking) {
      const fix = v.fixVersion
        ? `fix available → ${v.fixVersion}`
        : v.fixAvailable
        ? "fix available"
        : "no fix available";
      log(`    [${v.severity.toUpperCase()}] ${v.name} — ${fix}`);
    }
    log("");
  }

  const highCount = (counts as any).high ?? 0;
  const criticalCount = (counts as any).critical ?? 0;
  const passed = criticalCount === 0 && highCount === 0;

  if (passed) {
    ok("npm audit passed: no high or critical vulnerabilities found");
  } else {
    error(
      `npm audit found ${criticalCount} critical and ${highCount} high severity vulnerabilities.`,
    );
    log("  Run `npm audit fix` to automatically remediate fixable issues.");
    log("  For manual fixes see: https://docs.npmjs.com/auditing-package-dependencies-for-security-vulnerabilities");
  }

  return {
    ran: true,
    passed,
    counts: counts as Record<string, number>,
    vulns,
    totalDependencies,
  };
}

// ─── Snyk scan ────────────────────────────────────────────────────────────────

function runSnykScan(): AuditCheckResult {
  heading("Snyk — static vulnerability scan");

  const token = process.env.SNYK_TOKEN;
  if (!token) {
    warn(
      "SNYK_TOKEN environment variable is not set. " +
      "Skipping Snyk scan. Set SNYK_TOKEN or run `snyk auth` to enable.",
    );
    return {
      ran: false,
      passed: true, // Don't fail the build if Snyk is not configured
      counts: {},
      error: "SNYK_TOKEN not set",
    };
  }

  const snykBin = spawnSync("which", ["snyk"], { encoding: "utf-8" });
  if (snykBin.status !== 0) {
    warn("Snyk CLI is not installed. Install it with `npm install -g snyk`.");
    return {
      ran: false,
      passed: true,
      counts: {},
      error: "Snyk CLI not found",
    };
  }

  let snykOutput = "";
  let snykExitCode = 0;

  try {
    snykOutput = execSync("snyk test --json --severity-threshold=high", {
      cwd: ROOT,
      stdio: "pipe",
      encoding: "utf-8",
      env: { ...process.env, SNYK_TOKEN: token },
    });
  } catch (err: any) {
    snykOutput = (err.stdout as string) ?? "";
    snykExitCode = err.status ?? 1;
  }

  let snykReport: any = {};
  try {
    snykReport = JSON.parse(snykOutput);
  } catch {
    warn("Could not parse Snyk JSON output.");
    return { ran: true, passed: snykExitCode === 0, counts: {} };
  }

  const vulnCount: number = snykReport.vulnerabilities?.length ?? 0;
  const passed = snykExitCode === 0 || vulnCount === 0;

  if (passed) {
    ok("Snyk scan passed: no high or critical vulnerabilities found");
  } else {
    error(`Snyk found ${vulnCount} vulnerability(ies) at high or critical severity.`);
    log("  Run `snyk fix` or review https://snyk.io/test for remediation guidance.");
  }

  return {
    ran: true,
    passed,
    counts: { total: vulnCount },
  };
}

// ─── Report generation ────────────────────────────────────────────────────────

function writeReport(summary: SecuritySummary) {
  try {
    ensureReportDir();
    writeFileSync(REPORT_FILE, JSON.stringify(summary, null, 2), "utf-8");
    ok(`Security report written to ${REPORT_FILE}`);
  } catch (err) {
    warn(`Could not write report: ${(err as Error).message}`);
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────────

function main() {
  log("\n🔐  Soroban DevConsole — Security Vulnerability Audit");
  log(`    Timestamp: ${new Date().toISOString()}`);
  log(`    Workspace: ${ROOT}`);

  if (!existsSync(join(ROOT, "package-lock.json"))) {
    error("package-lock.json not found. Run `npm install` before auditing.");
    process.exit(1);
  }

  // Run npm audit
  const npmResult = runNpmAudit();

  // Optionally run Snyk
  let snykResult: AuditCheckResult | undefined;
  if (RUN_SNYK) {
    snykResult = runSnykScan();
  }

  // Overall pass/fail
  const allPassed =
    npmResult.passed && (snykResult === undefined || snykResult.passed);

  const summary: SecuritySummary = {
    timestamp: new Date().toISOString(),
    passed: allPassed,
    checks: {
      npmAudit: {
        ran: npmResult.ran,
        passed: npmResult.passed,
        counts: npmResult.counts,
        error: npmResult.error,
      },
      ...(snykResult ? { snyk: snykResult } : {}),
    },
    vulnerabilities: npmResult.vulns,
    totalDependencies: npmResult.totalDependencies,
  };

  writeReport(summary);

  heading("Summary");

  if (allPassed) {
    ok("All security checks passed. No blocking vulnerabilities detected.");
    process.exit(0);
  } else {
    error(
      "Security audit FAILED. Resolve all HIGH and CRITICAL vulnerabilities before merging.",
    );
    log("\n  Suggested next steps:");
    log("   1. Run `npm audit fix` for automatic remediations.");
    log("   2. Run `npm audit fix --force` for breaking-change remediations (review carefully).");
    log("   3. Update affected packages manually if `npm audit fix` is insufficient.");
    log("   4. Open a security issue if a patch is not yet available.\n");
    process.exit(1);
  }
}

main();
