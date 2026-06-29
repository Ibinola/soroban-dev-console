/**
 * Issue #505 (DEVOPS-420): Tighten the CI matrix around changed packages
 *
 * Problem: The CI matrix currently runs ALL checks for every PR, regardless
 * of which packages changed. A docs-only PR triggers the full web, API,
 * contracts, and e2e matrix — wasting minutes of CI time.
 *
 * Solution: Use turborepo's --filter and dorny/paths-filter to only run
 * checks for packages that actually changed. Full coverage runs on main.
 */

// ---- FIXED: ci.yml — changes job (already exists) ----
// The changes job is already in place. The fix is to tighten the `if`
// conditions per job and use turbo's --filter for granular targeting.

// ---- FIXED: ci.yml — web job ----
web:
  name: Web
  needs: changes
  # Only run when web or its deps changed, OR on push to main
  if: |
    needs.changes.outputs.web == 'true'
    || needs.changes.outputs.packages == 'true'
    || github.event_name == 'push'
  runs-on: ubuntu-latest
  steps:
    - uses: actions/checkout@v4
    - uses: actions/setup-node@v4
      with:
        node-version: 20
        cache: "npm"

    - name: Install dependencies
      run: npm ci

    - name: Install changed dependencies only
      run: npx turbo run build --filter=@devconsole/web...   # ... = changed + deps

    - name: Lint web (only if web changed)
      if: needs.changes.outputs.web == 'true'
      run: npm run lint -w web

    - name: Build web
      run: npm run build -w web

    - name: Typecheck web
      run: npm run typecheck -w web

    - name: Run unit tests (only web changes)
      if: needs.changes.outputs.web == 'true'
      run: npm run test:run -w web

// ---- FIXED: ci.yml — packages job (matrix only for changed packages) ----
packages:
  name: Package Validation (${{ matrix.workspace }})
  needs: changes
  if: needs.changes.outputs.packages == 'true' || github.event_name == 'push'
  runs-on: ubuntu-latest
  strategy:
    fail-fast: false
    matrix:
      # Dynamically determine which packages changed
      workspace: ${{ fromJSON(needs.changes.outputs.packages-list || '["@devconsole/ui", "@devconsole/soroban-utils"]') }}
  steps:
    - uses: actions/checkout@v4
    - uses: actions/setup-node@v4
      with:
        node-version: 20
        cache: "npm"
    - name: Install dependencies
      run: npm ci
    - name: Validate package
      run: npx turbo run lint typecheck build --filter=${{ matrix.workspace }}

// The key addition is the `packages-list` output from the changes job:
// changes:
//   outputs:
//     packages-list: ${{ steps.filter.outputs.packages-list }}

// In the filter step:
// - uses: dorny/paths-filter@v3
//   id: filter
//   with:
//     list-files: json
//     filters: |
//       packages-list:
//         - 'packages/*/package.json'
//       web:
//         - 'apps/web/**'
//         - 'packages/ui/**'
//       packages:
//         - 'packages/**'
//       api:
//         - 'apps/api/**'
//       contracts:
//         - 'contracts/**'

// ---- script to detect changed packages ----
// scripts/detect-changed-packages.ts
import { execSync } from "child_process";

const base = process.env.BASE_SHA || "origin/main";
const head = process.env.HEAD_SHA || "HEAD";

const changedFiles = execSync(
  `git diff --name-only ${base}...${head}`, { encoding: "utf-8" }
).trim().split("\n");

const packageMap: Record<string, string> = {
  "apps/web": "@devconsole/web",
  "apps/api": "@devconsole/api",
  "packages/ui": "@devconsole/ui",
  "packages/soroban-utils": "@devconsole/soroban-utils",
  "packages/api-contracts": "@devconsole/api-contracts",
  "contracts": "contracts",
};

const changed = new Set<string>();
for (const file of changedFiles) {
  for (const [prefix, pkg] of Object.entries(packageMap)) {
    if (file.startsWith(prefix)) changed.add(pkg);
  }
}

// Print JSON array for the CI matrix
console.log(JSON.stringify([...changed]));
