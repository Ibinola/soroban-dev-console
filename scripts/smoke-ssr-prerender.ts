/**
 * DEVOPS-029: Smoke test for SSR/prerender routes consuming runtime-config and fixture fallbacks.
 * Catches build-only regressions in static generation that pass in dev mode.
 */

import fs from "node:fs";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

interface SmokeCheck {
  route: string;
  description: string;
}

const SMOKE_ROUTES: SmokeCheck[] = [
  { route: "/deploy/wasm", description: "WASM deploy page with runtime-config" },
  { route: "/", description: "Home page with fixture fallback" },
];

async function runSmokeTests(): Promise<void> {
  console.log("Running SSR/prerender smoke tests...\n");

  try {
    console.log("[1/2] Building Next.js app with static generation...");
    await execAsync("npm run build", { cwd: "apps/web" });
    console.log("[OK]  Build succeeded\n");

    console.log("[2/2] Checking prerendered routes...");
    let allExist = true;
    for (const check of SMOKE_ROUTES) {
      const outPath = `apps/web/.next/server/app${check.route}.html`;
      if (fs.existsSync(outPath)) {
        console.log(`  [OK]   ${check.route}: ${check.description}`);
      } else {
        console.error(`  [FAIL] ${check.route}: prerendered file not found at ${outPath}`);
        allExist = false;
      }
    }
    if (allExist) {
      console.log("[OK]  All smoke routes passed\n");
    } else {
      console.error("\n[FAIL] Some prerendered routes are missing");
      process.exit(1);
    }

    console.log("✓ SSR/prerender smoke coverage complete");
  } catch (error) {
    console.error("\n[FAIL] Smoke test failed:");
    console.error(error);
    process.exit(1);
  }
}

runSmokeTests();
