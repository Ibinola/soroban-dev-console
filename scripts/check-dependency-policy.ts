import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const ROOT = process.cwd();
const POLICY_PATH = path.join(ROOT, "dependency-policy.json");

interface DependencyPolicy {
  version: number;
  criticalPackages: string[];
  rules: {
    patch: { autoMerge: boolean; requiredReviewers: number };
    minor: {
      critical: { autoMerge: boolean; requiredReviewers: number };
      nonCritical: { autoMerge: boolean; requiredReviewers: number };
    };
    major: { autoMerge: boolean; requiredReviewers: number; blockDuringWave: boolean; waveCooldownDays: number };
  };
  securityUpdates: Record<string, { responseTimeHours: number; bypassFreeze: boolean }>;
  freeze: { enabled: boolean; waveStartDate: string | null; cooldownDays: number };
}

if (!fs.existsSync(POLICY_PATH)) {
  console.error("Dependency policy file not found at dependency-policy.json");
  process.exit(1);
}

const policy: DependencyPolicy = JSON.parse(fs.readFileSync(POLICY_PATH, "utf-8"));

if (!policy.version || !policy.criticalPackages || !policy.rules) {
  console.error("Dependency policy file is malformed or incomplete");
  process.exit(1);
}

console.log(`Dependency policy v${policy.version} loaded`);
console.log(`Critical packages (${policy.criticalPackages.length}): ${policy.criticalPackages.join(", ")}`);

if (policy.freeze.enabled) {
  console.warn(`Wave freeze is active until ${policy.freeze.waveStartDate}`);
  console.warn(`Major updates are blocked during freeze period`);
}

const rootPkg = JSON.parse(fs.readFileSync(path.join(ROOT, "package.json"), "utf-8"));
const allDeps = { ...rootPkg.dependencies, ...rootPkg.devDependencies };
const criticalDeps = Object.keys(allDeps).filter(dep => policy.criticalPackages.includes(dep));

for (const dep of criticalDeps) {
  const pkgPath = path.join(ROOT, "node_modules", dep, "package.json");
  if (fs.existsSync(pkgPath)) {
    const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8"));
    const version = pkg.version;
    const declared = allDeps[dep] as string;
    console.log(`  ${dep}: declared=${declared}, installed=${version}`);
  }
}

const workspacePaths = (rootPkg.workspaces as string[]) || [];
for (const pattern of workspacePaths) {
  const base = pattern.replace(/\/\*$/, "");
  const fullBase = path.join(ROOT, base);
  if (!fs.existsSync(fullBase)) continue;
  for (const dir of fs.readdirSync(fullBase)) {
    const pkgPath = path.join(fullBase, dir, "package.json");
    if (!fs.existsSync(pkgPath)) continue;
    const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8"));
    const deps = { ...pkg.dependencies, ...pkg.devDependencies };
    for (const [depName, depVersion] of Object.entries(deps)) {
      if (policy.criticalPackages.includes(depName)) {
        if (depVersion.startsWith("^") || depVersion.startsWith("~")) {
          console.log(`  ${pkg.name} -> ${depName}@${depVersion}`);
        }
      }
    }
  }
}

console.log("Dependency policy check passed");
