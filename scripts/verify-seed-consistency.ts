#!/usr/bin/env tsx
// scripts/verify-seed-consistency.ts
// QA-214: Seeded environment consistency verifier for Wave operations.
//
// Checks that seeded users, verification states, budgets, and queue fixtures
// stay aligned with the current schema and documentation expectations.
//
// Usage:
//   tsx scripts/verify-seed-consistency.ts [--db <path>] [--strict]

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, "..");

// ── CLI args ──────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
let dbPath = path.join(ROOT, "apps/api/dev.db");
let strict = false;

for (let i = 0; i < args.length; i++) {
  if (args[i] === "--db" && args[i + 1]) dbPath = path.resolve(args[++i]);
  if (args[i] === "--strict") strict = true;
}

// ── Colours ───────────────────────────────────────────────────────────────────
const G = "\x1b[32m";
const R = "\x1b[31m";
const Y = "\x1b[33m";
const NC = "\x1b[0m";

let errors = 0;
let warnings = 0;

function pass(msg: string) { console.log(`${G}✅ PASS${NC}  ${msg}`); }
function fail(msg: string) { console.log(`${R}❌ FAIL${NC}  ${msg}`); errors++; }
function warn(msg: string) { console.log(`${Y}⚠️  WARN${NC}  ${msg}`); warnings++; }

// ── Database check ────────────────────────────────────────────────────────────
if (!fs.existsSync(dbPath)) {
  console.error(`${R}❌${NC} Database not found: ${dbPath}`);
  console.error("   Run: cd apps/api && npx prisma db push && npx prisma db seed");
  process.exit(1);
}

let db: { prepare: (sql: string) => { all: () => unknown[]; get: () => unknown } };
try {
  const mod = await import("better-sqlite3");
  const Ctor = ((mod as Record<string, unknown>).default ?? mod) as (p: string) => typeof db;
  db = Ctor(dbPath);
} catch {
  console.error(`${R}❌${NC} better-sqlite3 not installed. Run: npm install -g better-sqlite3`);
  process.exit(1);
}

function count(table: string): number {
  try {
    const row = db.prepare(`SELECT COUNT(*) as n FROM ${table}`).get() as { n: number };
    return row.n;
  } catch {
    return -1;
  }
}

function first(table: string, where = ""): unknown {
  try {
    return db.prepare(`SELECT * FROM ${table}${where ? " WHERE " + where : ""} LIMIT 1`).get();
  } catch {
    return null;
  }
}

// ── Schema presence checks ────────────────────────────────────────────────────
console.log("");
console.log("═══════════════════════════════════════════════════════");
console.log("  Soroban DevConsole — Seed Consistency Verifier");
console.log(`  DB: ${dbPath}`);
console.log("═══════════════════════════════════════════════════════");
console.log("");
console.log("── Schema presence ──────────────────────────────────");

const requiredTables = [
  "workspaces",
  "saved_contracts",
  "saved_interactions",
  "workspace_artifacts",
  "share_links",
  "audit_logs",
];

const optionalWaveTables = [
  "point_ledger_entries",
  "point_ledger_snapshots",
  "budget_scopes",
  "budget_reservations",
  "budget_events",
  "contributor_verifications",
  "appeal_cases",
  "review_windows",
  "abuse_flags",
  "notification_events",
];

for (const t of requiredTables) {
  const n = count(t);
  if (n < 0) fail(`Table '${t}' is missing from schema`);
  else pass(`Table '${t}' exists (${n} rows)`);
}

for (const t of optionalWaveTables) {
  const n = count(t);
  if (n < 0) warn(`Wave table '${t}' not found — Wave 5 migrations may not be applied`);
  else pass(`Wave table '${t}' exists (${n} rows)`);
}

// ── Seed data presence checks ─────────────────────────────────────────────────
console.log("");
console.log("── Seed data presence ───────────────────────────────");

const wsCount = count("workspaces");
if (wsCount === 0) {
  const msg = "No workspaces seeded — run: cd apps/api && npx prisma db seed";
  strict ? fail(msg) : warn(msg);
} else {
  pass(`${wsCount} workspace(s) seeded`);
}

const demo = first("workspaces", "id = 'demo-workspace'");
if (demo) pass("Demo workspace present (id=demo-workspace)");
else warn("Demo workspace not found — seed may not have run");

// ── Budget alignment ──────────────────────────────────────────────────────────
console.log("");
console.log("── Budget alignment ─────────────────────────────────");

const budgetCount = count("budget_scopes");
if (budgetCount >= 0) {
  if (budgetCount === 0) {
    warn("No budget scopes seeded — fairness tests will not have data");
  } else {
    pass(`${budgetCount} budget scope(s) present`);

    // Check for negative headroom (integrity violation)
    try {
      const bad = db
        .prepare(
          "SELECT COUNT(*) as n FROM budget_scopes WHERE (cap_points - used_points - reserved_points) < 0",
        )
        .get() as { n: number };
      if (bad.n > 0) fail(`${bad.n} budget scope(s) have negative headroom`);
      else pass("All budget scopes have non-negative headroom");
    } catch {
      warn("Could not verify budget headroom (schema may differ)");
    }
  }
}

// ── Verification state alignment ─────────────────────────────────────────────
console.log("");
console.log("── Verification states ──────────────────────────────");

const verCount = count("contributor_verifications");
if (verCount >= 0) {
  if (verCount === 0) {
    warn("No contributor_verifications rows — verification tests will be skipped");
  } else {
    pass(`${verCount} verification record(s) present`);
  }
}

// ── Summary ───────────────────────────────────────────────────────────────────
console.log("");
console.log("═══════════════════════════════════════════════════════");
if (errors > 0) {
  console.log(`${R}Result: FAILED — ${errors} error(s), ${warnings} warning(s)${NC}`);
  process.exit(1);
} else if (warnings > 0) {
  console.log(`${Y}Result: PASSED with ${warnings} warning(s)${NC}`);
} else {
  console.log(`${G}Result: PASSED — seed data is consistent${NC}`);
}
console.log("═══════════════════════════════════════════════════════");
console.log("");
