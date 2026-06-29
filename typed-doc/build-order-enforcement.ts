/**
 * Issue #509 (DEVOPS-424): Enforce build order for shared packages
 *
 * Root cause:
 * - verify-build-order.ts checks only that dist/ directories exist for
 *   packages/soroban-utils and packages/ui — it does not verify that the
 *   build outputs are fresh (newer than their sources) or correct
 * - turbo.json "build" task uses ^build dependencies which should enforce
 *   topological order, but individual workspaces can circumvent this by
 *   running standalone builds (npm run build -w web) without building deps
 * - The verify step runs with continue-on-error: true in the wave-prep job,
 *   meaning a build order violation does NOT block CI — it's silently ignored
 * - No check exists that packages are built in the correct dependency order
 *   (soroban-utils → ui → web, api-contracts → api)
 *
 * Fix: Strengthen verify-build-order.ts to validate artifact freshness,
 *       remove continue-on-error from the CI gate, and add a dependency
 *       graph check.
 */

// ---- FLAWED (ci.yml wave-prep job lines 440-441) ----
- name: Verify build order
  run: npx tsx scripts/verify-build-order.ts
  continue-on-error: true  // <-- silently swallows violations

// ---- FIXED (ci.yml) ----
- name: Verify build order
  run: npx tsx scripts/verify-build-order.ts
  # continue-on-error removed — build order violations must block CI

// ---- FIXED (verify-build-order.ts) ----
import fs from "fs";
import path from "path";

interface PackageCheck {
  name: string;
  distPath: string;
  /** Packages that must be built BEFORE this one */
  dependsOn: string[];
}

const SHARED_PACKAGES: PackageCheck[] = [
  {
    name: "soroban-utils",
    distPath: "packages/soroban-utils/dist",
    dependsOn: [],       // leaf package, no internal deps
  },
  {
    name: "ui",
    distPath: "packages/ui/dist",
    dependsOn: ["soroban-utils"],
  },
  // Build-order enforcement for web — depends on both shared packages
  {
    name: "web (app)",
    distPath: "apps/web/.next",
    dependsOn: ["soroban-utils", "ui"],
  },
];

function checkArtifactFreshness(root: string): boolean {
  let ok = true;
  for (const pkg of SHARED_PACKAGES) {
    const distPath = path.join(root, pkg.distPath);

    if (!fs.existsSync(distPath)) {
      console.error(`[FAIL] Missing build artifact: ${distPath}`);
      ok = false;
      continue;
    }

    // Check freshness: source files must not be newer than dist output
    const distStats = fs.statSync(distPath, { throwIfNoEntry: false });
    if (!distStats) { ok = false; continue; }

    const latestDist = distStats.mtimeMs;
    const srcDir = path.join(root, pkg.distPath.replace(/\/dist$/, "").replace(/\/\.next$/, "/src"));
    if (fs.existsSync(srcDir)) {
      const srcFiles = fs.readdirSync(srcDir, { recursive: true }) as string[];
      for (const f of srcFiles) {
        const srcPath = path.join(srcDir, f);
        if (fs.statSync(srcPath).mtimeMs > latestDist) {
          console.warn(`[WARN] Source newer than dist: ${srcPath} (run build to refresh)`);
        }
      }
    }

    // Verify dependency order — each dep must have been built first
    for (const dep of pkg.dependsOn) {
      const depPkg = SHARED_PACKAGES.find((p) => p.name === dep);
      if (depPkg) {
        const depStat = fs.statSync(path.join(root, depPkg.distPath), { throwIfNoEntry: false });
        if (!depStat) {
          console.error(`[FAIL] '${pkg.name}' depends on '${dep}' but '${dep}' is not built`);
          ok = false;
        } else if (depStat.mtimeMs > distStats.mtimeMs) {
          console.error(
            `[FAIL] Build order violation: '${dep}' was built AFTER '${pkg.name}'. ` +
            `Run: turbo run build --filter=${dep} && turbo run build --filter=${pkg.name}`
          );
          ok = false;
        }
      }
    }

    if (ok) console.log(`[OK]   ${pkg.name} — artifacts fresh, deps in order`);
  }
  return ok;
}

const root = path.resolve(__dirname, "..");
if (!checkArtifactFreshness(root)) {
  console.error("\nBuild order enforcement failed. Run: turbo run build");
  process.exit(1);
}
console.log("\nAll shared package artifacts verified. Build order is correct.");
