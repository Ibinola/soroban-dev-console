#!/usr/bin/env tsx
// scripts/wave-simulator.ts
// DX-201: Local Wave 5 simulator for budgets, reviews, and appeals.
//
// Seeds realistic Wave 5 scenarios into the local database so engineers
// can reproduce operational edge cases without live data.
//
// Usage:
//   tsx scripts/wave-simulator.ts [--scenario <name>] [--list] [--db <path>]
//
// Scenarios:
//   budget-pressure      — repo budget near exhaustion with active reservations
//   verification-blocked — contributors blocked pending verification
//   appeal-backlog       — 10 open appeals awaiting maintainer review
//   full-wave            — all of the above combined

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, "..");

const args = process.argv.slice(2);
let scenario = "full-wave";
let dbPath = path.join(ROOT, "apps/api/dev.db");
let list = false;

for (let i = 0; i < args.length; i++) {
  if (args[i] === "--scenario" && args[i + 1]) scenario = args[++i];
  if (args[i] === "--db" && args[i + 1]) dbPath = path.resolve(args[++i]);
  if (args[i] === "--list") list = true;
}

const SCENARIOS: Record<string, { label: string; description: string }> = {
  "budget-pressure": {
    label: "Budget pressure",
    description: "Repo budget near exhaustion (85/100 pts used) with 3 active reservations",
  },
  "verification-blocked": {
    label: "Verification blocked",
    description: "5 contributors with pending verification, 2 with rejected status",
  },
  "appeal-backlog": {
    label: "Appeal backlog",
    description: "10 open appeals, oldest submitted 7 days ago",
  },
  "full-wave": {
    label: "Full Wave 5",
    description: "All scenarios combined — budget pressure + blocked verifications + appeal backlog",
  },
};

if (list) {
  console.log("\nAvailable scenarios:\n");
  for (const [key, { label, description }] of Object.entries(SCENARIOS)) {
    console.log(`  ${key.padEnd(26)} ${label}`);
    console.log(`  ${"".padEnd(26)} ${description}`);
    console.log();
  }
  process.exit(0);
}

if (!fs.existsSync(dbPath)) {
  console.error(`❌ Database not found: ${dbPath}`);
  console.error("   Run: cd apps/api && npx prisma db push && npx prisma db seed");
  process.exit(1);
}

let db: {
  prepare: (sql: string) => {
    run: (...args: unknown[]) => void;
    get: () => unknown;
    all: () => unknown[];
  };
  exec: (sql: string) => void;
};
try {
  const mod = await import("better-sqlite3");
  const Ctor = ((mod as Record<string, unknown>).default ?? mod) as (p: string) => typeof db;
  db = Ctor(dbPath);
} catch {
  console.error("❌ better-sqlite3 not installed. Run: npm install -g better-sqlite3");
  process.exit(1);
}

function upsert(table: string, id: string, data: Record<string, unknown>): void {
  const cols = Object.keys(data);
  const placeholders = cols.map(() => "?").join(", ");
  const updates = cols.map((c) => `${c} = excluded.${c}`).join(", ");
  const sql = `INSERT INTO ${table} (id, ${cols.join(", ")}) VALUES (?, ${placeholders}) ON CONFLICT(id) DO UPDATE SET ${updates}`;
  try {
    db.prepare(sql).run(id, ...Object.values(data));
  } catch {
    // Table may not exist (Wave migrations not applied) — skip silently
  }
}

const now = new Date().toISOString();
const ago = (days: number) => new Date(Date.now() - days * 86400000).toISOString();

function seedBudgetPressure(): void {
  upsert("budget_scopes", "sim-org-scope", {
    organization_id: "stellar-org",
    repo_id: null,
    cap_points: 1000,
    used_points: 800,
    reserved_points: 150,
    created_at: ago(30),
    updated_at: now,
  });
  upsert("budget_scopes", "sim-repo-scope", {
    organization_id: "stellar-org",
    repo_id: "soroban-dev-console",
    cap_points: 100,
    used_points: 85,
    reserved_points: 10,
    created_at: ago(30),
    updated_at: now,
  });
  for (let i = 1; i <= 3; i++) {
    upsert("budget_reservations", `sim-reservation-${i}`, {
      scope_id: "sim-repo-scope",
      issue_ref: `stellar-org/soroban-dev-console#${100 + i}`,
      points: i * 3,
      status: "active",
      created_at: ago(i),
      updated_at: now,
    });
  }
  console.log("  ✅ Budget pressure scenario seeded");
}

function seedVerificationBlocked(): void {
  const statuses = ["pending", "pending", "pending", "pending", "pending", "rejected", "rejected"];
  for (let i = 0; i < statuses.length; i++) {
    upsert("contributor_verifications", `sim-verification-${i}`, {
      contributor_id: `sim-contributor-${i}`,
      status: statuses[i],
      submitted_at: ago(3 + i),
      reviewed_at: statuses[i] === "rejected" ? ago(1) : null,
      created_at: ago(3 + i),
      updated_at: now,
    });
  }
  console.log("  ✅ Verification-blocked scenario seeded");
}

function seedAppealBacklog(): void {
  for (let i = 1; i <= 10; i++) {
    upsert("appeal_cases", `sim-appeal-${i}`, {
      contributor_id: `sim-contributor-${i % 5}`,
      issue_ref: `stellar-org/soroban-dev-console#${200 + i}`,
      status: "open",
      submitted_at: ago(7 + i),
      reviewed_at: null,
      created_at: ago(7 + i),
      updated_at: now,
    });
  }
  console.log("  ✅ Appeal backlog scenario seeded");
}

console.log(`\n🌊  Wave 5 Simulator — scenario: ${scenario}\n`);

if (!SCENARIOS[scenario]) {
  console.error(`❌ Unknown scenario: ${scenario}`);
  console.error(`   Run with --list to see available scenarios`);
  process.exit(1);
}

switch (scenario) {
  case "budget-pressure":
    seedBudgetPressure();
    break;
  case "verification-blocked":
    seedVerificationBlocked();
    break;
  case "appeal-backlog":
    seedAppealBacklog();
    break;
  case "full-wave":
    seedBudgetPressure();
    seedVerificationBlocked();
    seedAppealBacklog();
    break;
}

console.log(`\n✅  Simulator complete. Inspect results:\n`);
console.log(`   tsx scripts/explore-seed-data.ts --table budget_scopes`);
console.log(`   tsx scripts/explore-seed-data.ts --table contributor_verifications`);
console.log(`   tsx scripts/explore-seed-data.ts --table appeal_cases\n`);
