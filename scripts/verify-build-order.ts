/**
 * DEVOPS-028: Verifies shared package artifacts exist before app builds consume them.
 * Run before app-level builds to catch missing outputs early.
 */

import fs from "fs";
import path from "path";

interface PackageCheck {
  name: string;
  distPath: string;
}

const SHARED_PACKAGES: PackageCheck[] = [
  { name: "soroban-utils", distPath: "packages/soroban-utils/dist" },
  { name: "ui", distPath: "packages/ui/dist" },
];

function checkPackageArtifacts(root: string): void {
  const missing: string[] = [];

  for (const pkg of SHARED_PACKAGES) {
    const fullPath = path.join(root, pkg.distPath);
    if (!fs.existsSync(fullPath)) {
      missing.push(pkg.name);
      console.error(`[FAIL] Missing build artifact: ${fullPath}`);
    } else {
      console.log(`[OK]   ${pkg.name} artifacts found at ${fullPath}`);
    }
  }

  if (missing.length > 0) {
    console.error(
      `\nBuild order violation: ${missing.join(", ")} must be built before app layers.`
    );
    console.error("Run: turbo run build --filter=./packages/*");
    process.exit(1);
  }

  console.log("\nAll shared package artifacts verified. App builds may proceed.");
}

const repoRoot = path.resolve(__dirname, "..");
checkPackageArtifacts(repoRoot);
