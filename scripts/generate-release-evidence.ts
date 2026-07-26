/**
 * DEVOPS-216: Generate release evidence bundles for audits and wave readiness.
 *
 * Captures commit range, validation outputs, config checks, and service health
 * notes into a repeatable artifact for maintainers and auditors.
 *
 * Usage:
 *   npx tsx scripts/generate-release-evidence.ts --wave wave-5
 *   npx tsx scripts/generate-release-evidence.ts --wave wave-5 --base origin/main --quick
 */

import { execSync, spawnSync } from "child_process";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

type CheckStatus = "pass" | "fail" | "warn" | "skip";

interface CheckDefinition {
  id: string;
  name: string;
  category: "config" | "validation" | "build";
  command: string;
  repro: string;
  required: boolean;
  /** Skip when --quick */
  heavy?: boolean;
}

interface CheckResult {
  id: string;
  name: string;
  category: string;
  status: CheckStatus;
  exitCode: number | null;
  durationMs: number;
  reproCommand: string;
  summary: string;
  logFile: string;
}

interface CliOptions {
  wave: string;
  base: string;
  output: string;
  quick: boolean;
  skipChecks: boolean;
  layerResultsPath?: string;
  github?: {
    runId?: string;
    sha?: string;
    ref?: string;
    actor?: string;
    repository?: string;
  };
}

const CHECKS: CheckDefinition[] = [
  {
    id: "check-drift",
    name: "Runtime config drift",
    category: "config",
    command: "npm run check-drift",
    repro: "npm run check-drift",
    required: true,
  },
  {
    id: "check-integrity",
    name: "Dependency integrity",
    category: "config",
    command: "npm run check-integrity",
    repro: "npm run check-integrity",
    required: true,
  },
  {
    id: "validate-branch-workflow",
    name: "Branch workflow",
    category: "validation",
    command: "npx tsx scripts/validate-branch-workflow.ts",
    repro: "npx tsx scripts/validate-branch-workflow.ts",
    required: false,
  },
  {
    id: "verify-build-order",
    name: "Shared package build order",
    category: "build",
    command: "npx tsx scripts/verify-build-order.ts",
    repro: "npx tsx scripts/verify-build-order.ts",
    required: true,
  },
  {
    id: "prisma-validate",
    name: "Prisma schema",
    category: "validation",
    command:
      "npm run prisma:generate -w api && npx prisma validate --schema apps/api/prisma/schema.prisma",
    repro:
      "npm run prisma:generate -w api && npx prisma validate --schema apps/api/prisma/schema.prisma",
    required: true,
  },
  {
    id: "verify-migrations",
    name: "Migration consistency",
    category: "validation",
    command: "bash scripts/verify-migrations.sh",
    repro: "bash scripts/verify-migrations.sh",
    required: false,
  },
  {
    id: "smoke-ssr-prerender",
    name: "SSR / prerender smoke",
    category: "build",
    command: "npx tsx scripts/smoke-ssr-prerender.ts",
    repro: "npx tsx scripts/smoke-ssr-prerender.ts",
    required: false,
    heavy: true,
  },
];

function parseArgs(): CliOptions {
  const args = process.argv.slice(2);
  let wave = "";
  let base = "origin/main";
  let output = "release-evidence";
  let quick = false;
  let skipChecks = false;
  let layerResultsPath: string | undefined;
  const github: CliOptions["github"] = {};

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--wave" && args[i + 1]) wave = args[++i];
    else if (arg === "--base" && args[i + 1]) base = args[++i];
    else if (arg === "--output" && args[i + 1]) output = args[++i];
    else if (arg === "--quick") quick = true;
    else if (arg === "--skip-checks") skipChecks = true;
    else if (arg === "--layer-results" && args[i + 1]) layerResultsPath = args[++i];
    else if (arg === "--github-run-id" && args[i + 1]) github.runId = args[++i];
    else if (arg === "--github-sha" && args[i + 1]) github.sha = args[++i];
    else if (arg === "--github-ref" && args[i + 1]) github.ref = args[++i];
    else if (arg === "--github-actor" && args[i + 1]) github.actor = args[++i];
    else if (arg === "--github-repository" && args[i + 1]) github.repository = args[++i];
    else if (arg === "--help" || arg === "-h") {
      console.log(`Usage: npx tsx scripts/generate-release-evidence.ts --wave <id> [options]

Options:
  --wave <id>              Wave label (required), e.g. wave-5
  --base <ref>             Commit range base (default: origin/main)
  --output <dir>           Output directory (default: release-evidence)
  --quick                  Skip heavy checks (SSR smoke)
  --skip-checks            Only capture git metadata and CI layer results
  --layer-results <path>   JSON file with CI job results
  --github-run-id <id>     Embed CI run metadata in manifest
  --github-sha <sha>
  --github-ref <ref>
  --github-actor <actor>
  --github-repository <owner/repo>
`);
      process.exit(0);
    }
  }

  if (!wave) {
    console.error("❌ --wave is required (e.g. --wave wave-5)");
    process.exit(1);
  }

  return { wave, base, output, quick, skipChecks, layerResultsPath, github };
}

function git(cmd: string): string {
  return execSync(cmd, { cwd: ROOT, encoding: "utf-8" }).trim();
}

function captureGitEvidence(outDir: string, baseRef: string): Record<string, unknown> {
  const gitDir = path.join(outDir, "git");
  fs.mkdirSync(gitDir, { recursive: true });

  const head = git("git rev-parse HEAD");
  const branch = git("git rev-parse --abbrev-ref HEAD");
  let remoteUrl = "unknown";
  try {
    remoteUrl = git("git remote get-url origin");
  } catch {
    /* optional */
  }

  let baseSha = "";
  let commitRange = "";
  let oneline = "";

  try {
    baseSha = git(`git merge-base ${baseRef} HEAD`);
    oneline = git(`git log ${baseSha}..HEAD --oneline`);
    commitRange = `${baseSha}..${head}`;
  } catch {
    oneline = `(could not resolve base ref "${baseRef}" — fetch it first)`;
    commitRange = `unknown..${head}`;
  }

  const meta = {
    head,
    branch,
    remoteUrl,
    baseRef,
    baseSha: baseSha || null,
    commitRange,
    commitCount: oneline ? oneline.split("\n").filter(Boolean).length : 0,
    capturedAt: new Date().toISOString(),
  };

  fs.writeFileSync(path.join(gitDir, "metadata.json"), JSON.stringify(meta, null, 2));
  fs.writeFileSync(path.join(gitDir, "commits-oneline.txt"), oneline || "(no commits in range)\n");
  fs.writeFileSync(
    path.join(gitDir, "commit-range.txt"),
    `Range: ${commitRange}\nBranch: ${branch}\nHEAD: ${head}\n`,
  );

  return meta;
}

function runCheck(def: CheckDefinition, checksDir: string): CheckResult {
  const logFile = path.join(checksDir, `${def.id}.log`);
  const start = Date.now();
  const result = spawnSync(def.command, {
    shell: true,
    cwd: ROOT,
    encoding: "utf-8",
    env: process.env,
  });
  const durationMs = Date.now() - start;

  const stdout = result.stdout ?? "";
  const stderr = result.stderr ?? "";
  fs.writeFileSync(logFile, `${stdout}\n${stderr}`.trim() + "\n");

  const exitCode = result.status;
  let status: CheckStatus = "pass";
  if (exitCode !== 0) {
    status = def.required ? "fail" : "warn";
  }

  const lastLine =
    (stderr || stdout)
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean)
      .pop() ?? "(no output)";

  return {
    id: def.id,
    name: def.name,
    category: def.category,
    status,
    exitCode,
    durationMs,
    reproCommand: def.repro,
    summary: lastLine.slice(0, 240),
    logFile: path.relative(ROOT, logFile),
  };
}

async function probeServiceHealth(): Promise<Record<string, unknown>> {
  const apiPort = 4000;
  const webPort = 3000;
  const probes = [
    { name: "api", url: `http://localhost:${apiPort}/api/health` },
    { name: "web", url: `http://localhost:${webPort}/` },
  ];

  const results = [];

  for (const probe of probes) {
    const entry: Record<string, unknown> = {
      name: probe.name,
      url: probe.url,
      probedAt: new Date().toISOString(),
    };
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 4000);
      const res = await fetch(probe.url, { signal: controller.signal });
      clearTimeout(timer);
      let body: unknown = null;
      const text = await res.text();
      try {
        body = JSON.parse(text);
      } catch {
        body = text.slice(0, 200);
      }
      entry.httpStatus = res.status;
      entry.status = res.ok ? "reachable" : "degraded";
      entry.body = body;
    } catch (err) {
      entry.status = "unreachable";
      entry.error = err instanceof Error ? err.message : String(err);
      entry.note =
        probe.name === "api"
          ? "Start the API locally (npm run dev in apps/api) to include a live health snapshot."
          : "Start the web app locally to include a live reachability snapshot.";
    }
    results.push(entry);
  }

  return {
    note: "Probes are best-effort. CI bundles typically show unreachable unless services run in the same job.",
    probes: results,
  };
}

function loadLayerResults(filePath: string): Record<string, string> | null {
  if (!fs.existsSync(filePath)) return null;
  return JSON.parse(fs.readFileSync(filePath, "utf-8")) as Record<string, string>;
}

function writeHumanReport(
  outDir: string,
  manifest: Record<string, unknown>,
  checkResults: CheckResult[],
): void {
  const lines: string[] = [
    "# Release Evidence Bundle",
    "",
    `**Wave:** ${manifest.wave}`,
    `**Generated:** ${manifest.timestamp}`,
    `**HEAD:** \`${manifest.git?.head ?? "unknown"}\``,
    `**Commit range:** \`${manifest.git?.commitRange ?? "unknown"}\` (${manifest.git?.commitCount ?? 0} commits)`,
    "",
    "## CI layer results",
    "",
  ];

  const layers = manifest.ciLayers as Record<string, string> | undefined;
  if (layers) {
    for (const [job, result] of Object.entries(layers)) {
      const icon = result === "success" ? "✅" : result === "skipped" ? "⏭️" : "❌";
      lines.push(`- ${icon} **${job}**: ${result}`);
    }
  } else {
    lines.push("_No CI layer results embedded (local run)._");
  }

  lines.push("", "## Validation & config checks", "");

  for (const c of checkResults) {
    const icon =
      c.status === "pass" ? "✅" : c.status === "warn" ? "⚠️" : c.status === "skip" ? "⏭️" : "❌";
    lines.push(`- ${icon} **${c.name}** (\`${c.id}\`) — ${c.summary}`);
    if (c.status === "fail" || c.status === "warn") {
      lines.push(`  - Reproduce: \`${c.reproCommand}\``);
      lines.push(`  - Log: \`${c.logFile}\``);
    }
  }

  lines.push("", "## Service health", "");
  const health = manifest.serviceHealth as { probes?: Array<{ name: string; status: string }> };
  if (health?.probes) {
    for (const p of health.probes) {
      lines.push(`- **${p.name}**: ${p.status}`);
    }
  }

  lines.push("", "## Audit checklist", "");
  lines.push("- [ ] Commit range matches the intended release branch");
  lines.push("- [ ] All required checks passed (no ❌ above)");
  lines.push("- [ ] CI layer matrix green (if applicable)");
  lines.push("- [ ] Bundle archived for the wave cutover record");
  lines.push("");

  fs.writeFileSync(path.join(outDir, "EVIDENCE.md"), lines.join("\n"));
}

function printActionableFailures(checkResults: CheckResult[]): void {
  const failures = checkResults.filter((c) => c.status === "fail");
  if (!failures.length) return;

  console.error("\n❌ Release evidence bundle has failing required checks:\n");
  for (const f of failures) {
    console.error(`  • ${f.name} (${f.id})`);
    console.error(`    Reproduce: ${f.reproCommand}`);
    console.error(`    Log: ${f.logFile}`);
    console.error(`    Summary: ${f.summary}\n`);
  }
}

function createTarball(outDir: string): string {
  const tarball = path.join(ROOT, "release-evidence-bundle.tar.gz");
  if (fs.existsSync(tarball)) fs.unlinkSync(tarball);
  const result = spawnSync("tar", ["-czf", tarball, "-C", outDir, "."], {
    cwd: ROOT,
    encoding: "utf-8",
  });
  if (result.status !== 0) {
    console.warn("⚠️  Could not create tarball (tar failed). Directory bundle is still available.");
    return "";
  }
  return tarball;
}

async function main(): Promise<void> {
  const opts = parseArgs();

  const outDir = path.isAbsolute(opts.output)
    ? opts.output
    : path.join(ROOT, opts.output);

  if (fs.existsSync(outDir)) {
    fs.rmSync(outDir, { recursive: true });
  }
  fs.mkdirSync(path.join(outDir, "checks"), { recursive: true });

  console.log(`\n📦 Generating release evidence for wave: ${opts.wave}\n`);

  const gitMeta = captureGitEvidence(outDir, opts.base);
  const checkResults: CheckResult[] = [];

  if (opts.skipChecks) {
    console.log("⏭️  Skipping local checks (--skip-checks); packaging metadata only.\n");
  } else {
    for (const def of CHECKS) {
      if (opts.quick && def.heavy) {
        checkResults.push({
          id: def.id,
          name: def.name,
          category: def.category,
          status: "skip",
          exitCode: null,
          durationMs: 0,
          reproCommand: def.repro,
          summary: "Skipped (--quick)",
          logFile: "",
        });
        console.log(`⏭️  ${def.name} (skipped — quick mode)`);
        continue;
      }

      process.stdout.write(`▶ ${def.name}… `);
      const result = runCheck(def, path.join(outDir, "checks"));
      checkResults.push(result);
      const icon = result.status === "pass" ? "✅" : result.status === "warn" ? "⚠️" : "❌";
      console.log(`${icon} (${result.durationMs}ms)`);
    }
  }

  const serviceHealth = await probeServiceHealth();
  fs.writeFileSync(
    path.join(outDir, "service-health.json"),
    JSON.stringify(serviceHealth, null, 2),
  );

  const ciLayers = opts.layerResultsPath
    ? loadLayerResults(opts.layerResultsPath)
    : null;

  if (ciLayers) {
    const failed = Object.entries(ciLayers).filter(([, v]) => v === "failure");
    if (failed.length) {
      console.error("\n❌ CI reports failed layers:");
      for (const [job, result] of failed) {
        console.error(`  • ${job}: ${result}`);
      }
    }
  }

  const requiredFailed = checkResults.some((c) => c.status === "fail");
  const ciFailed = ciLayers && Object.values(ciLayers).some((v) => v === "failure");

  const manifest = {
    schemaVersion: "1.0",
    wave: opts.wave,
    timestamp: new Date().toISOString(),
    git: gitMeta,
    ci: opts.github ?? null,
    ciLayers,
    checks: checkResults,
    serviceHealth,
    summary: {
      ready: !requiredFailed && !ciFailed,
      requiredChecksPassed: !requiredFailed,
      ciLayersPassed: ciLayers ? !ciFailed : null,
    },
  };

  fs.writeFileSync(path.join(outDir, "manifest.json"), JSON.stringify(manifest, null, 2));
  writeHumanReport(outDir, manifest, checkResults);

  const tarball = createTarball(outDir);
  const relOut = path.relative(ROOT, outDir);

  console.log(`\n✅ Evidence bundle written to ${relOut}/`);
  if (tarball) {
    console.log(`✅ Archive: ${path.relative(ROOT, tarball)}`);
  }
  console.log(`   • manifest.json — machine-readable summary`);
  console.log(`   • EVIDENCE.md — auditor / maintainer report`);
  console.log(`   • checks/*.log — full command output`);
  console.log(`   • git/ — commit range and metadata`);
  console.log(`   • service-health.json — health probe notes\n`);

  printActionableFailures(checkResults);

  if (requiredFailed || ciFailed) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("❌ generate-release-evidence failed:", err);
  process.exit(1);
});
