import { writeFileSync, mkdirSync } from "fs";
import { execSync } from "child_process";

interface ReleaseEvidence {
  version: string;
  commitHash: string;
  committedAt: string;
  branch: string;
  author: string;
  bundledAt: string;
}

function git(cmd: string): string {
  try { return execSync(cmd).toString().trim(); }
  catch { return "unknown"; }
}

function collectEvidence(): ReleaseEvidence {
  return {
    version: process.env.npm_package_version ?? "unknown",
    commitHash: git("git log -1 --format=%H"),
    committedAt: git("git log -1 --format=%ci"),
    branch: git("git rev-parse --abbrev-ref HEAD"),
    author: git("git log -1 --format=%an"),
    bundledAt: new Date().toISOString(),
  };
}

export function bundleReleaseEvidence(outputDir = "release-evidence"): void {
  mkdirSync(outputDir, { recursive: true });
  const evidence = collectEvidence();
  const path = `${outputDir}/evidence-${Date.now()}.json`;
  writeFileSync(path, JSON.stringify(evidence, null, 2), "utf-8");
  console.log(`Release evidence bundled to ${path}`);
}

bundleReleaseEvidence(process.argv[2] ?? "release-evidence");
