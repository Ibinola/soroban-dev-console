/**
 * Staged TypeScript Type-Checking Script (#1229)
 * Runs `tsc --noEmit` only on packages containing staged .ts/.tsx files.
 */
const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

try {
  // Get staged .ts and .tsx files
  const stagedFiles = execSync('git diff --cached --name-only --diff-filter=ACMR', { encoding: 'utf8' })
    .split('\n')
    .filter(file => /\.(ts|tsx)$/.test(file));

  if (stagedFiles.length === 0) {
    process.exit(0);
  }

  // Find unique package directories containing staged files
  const affectedPackages = new Set();
  stagedFiles.forEach(file => {
    const parts = file.split(path.sep);
    // Assuming monorepo structure like apps/* or packages/*
    if (parts.length > 1 && (parts[0] === 'apps' || parts[0] === 'packages')) {
      affectedPackages.add(path.join(parts[0], parts[1]));
    } else {
      // Root-level or other files
      affectedPackages.add('.');
    }
  });

  console.log(`[TypeCheck] Staged TypeScript files detected in ${affectedPackages.size} package(s). Running type check...`);

  for (const pkg of affectedPackages) {
    const tsconfigPath = pkg === '.' ? 'tsconfig.json' : path.join(pkg, 'tsconfig.json');
    if (fs.existsSync(tsconfigPath)) {
      console.log(`[TypeCheck] Checking ${pkg}...`);
      execSync(`npx tsc --noEmit -p ${tsconfigPath}`, { stdio: 'inherit' });
    }
  }

  console.log('[TypeCheck] All type checks passed successfully!');
  process.exit(0);
} catch (error) {
  console.error('\n[TypeCheck Error] TypeScript compilation check failed. Please fix the type errors above before committing.');
  console.error('[Escape Hatch] To bypass temporarily, use: git commit --no-verify\n');
  process.exit(1);
}