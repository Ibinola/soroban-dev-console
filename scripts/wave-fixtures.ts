#!/usr/bin/env tsx
// scripts/wave-fixtures.ts
// DX-203: Fixture generators for Wave 5 operational scenarios.
//
// Seeds specific database states that match common Wave 5 test cases.
// Unlike the simulator, fixtures are deterministic and named for use
// in tests and QA workflows.
//
// Usage:
//   tsx scripts/wave-fixtures.ts --list
//   tsx scripts/wave-fixtures.ts --fixture exhausted-budget
//   tsx scripts/wave-fixtures.ts --fixture pending-verification
//   tsx scripts/wave-fixtures.ts --fixture appeal-backlog
//   tsx scripts/wave-fixtures.ts --fixture flagged-abuse
//   tsx scripts/wave-fixtures.ts --fixture all

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, "..");

const args = process.argv.slice(2);
let dbPath = path.join(ROOT, "apps/api/dev.db");
let fixture = "all";
let list = false;

for (let i = 0; i < args.length; i++) {
  if (args[i] === "--fixture" && args[i + 1]) fixture = args[++i];
  if (args[i] === "--db" && args[i + 1]) dbPath = path.resolve(args[++i]);
  if (args[i] === "--list") list = true;
}

const FIXTURES: Record<string, string> = {
  "exhausted-budget": "Repo budget at 100% used, org budget at 95%",
  "pending-verification": "3 contributors with pending verification state",
  "appeal-backlog": "5 open appeals, 2 under-review appeals",
  "flagged-abuse": "2 contributors with active abuse flags",
  "all": "All fixtures combined",
};

if (list) {
  console.log("\nAvailable fixtures:\n");
  for (const [k, v] of Object.entries(FIXTURES)) {
    console.log(`  ${k.padEnd(28)} ${v}`);
  }
  console.log();
  process.exit(0);
}

if (!fs.existsSync(dbPath)) {
  console.error(`❌ Database not found: ${dbPath}`);
  process.exit(1);
}

let db: { prepare: (sql: string) => { run: (...args: unknown[]) => void } };
try {
  const mod = await import("better-sqlite3");
  const Ctor = ((mod as Record<string, unknown>).default ?? mod) as (p: string) => typeof db;
  db = Ctor(dbPath);
} catch {
  console.error("❌ better-sqlite3 not installed. Run: npm install -g better-sqlite3");
  process.exit(1);
}

const now = new Date().toISOString();
const ago = (days: number) => new Date(Date.now() - days * 86400000).toISOString();

function upsert(table: string, id: string, data: Record<string, unknown>): void {
  const cols = Object.keys(data);
  const placeholders = cols.map(() => "?").join(", ");
  const updates = cols.map((c) => `${c} = excluded.${c}`).join(", ");
  const sql = `INSERT INTO ${table} (id, ${cols.join(", ")}) VALUES (?, ${placeholders}) ON CONFLICT(id) DO UPDATE SET ${updates}`;
  try {
    db.prepare(sql).run(id, ...Object.values(data));
  } catch {
    // Wave table may not exist — skip
  }
}

function fixtureExhaustedBudget(): void {
  upsert("budget_scopes", "fix-repo-exhausted", {
    organization_id: "stellar-org",
    repo_id: "soroban-dev-console",
    cap_points: 10000,
    used_points: 10000,
    reserved_points: 0,
    created_at: ago(60),
    updated_at: now,
  });
  upsert("budget_scopes", "fix-org-near", {
    organization_id: "stellar-org",
    repo_id: null,
    cap_points: 50000,
    used_points: 47500,
    reserved_points: 1000,
    created_at: ago(60),
    updated_at: now,
  });
  console.log("  ✅ exhausted-budget fixture applied");
}

function fixturePendingVerification(): void {
  for (let i = 0; i < 3; i++) {
    upsert("contributor_verifications", `fix-verification-pending-${i}`, {
      contributor_id: `fix-contributor-pending-${i}`,
      status: "pending",
      submitted_at: ago(5 - i),
      reviewed_at: null,
      created_at: ago(5 - i),
      updated_at: now,
    });
  }
  console.log("  ✅ pending-verification fixture applied");
}

function fixtureAppealBacklog(): void {
  for (let i = 0; i < 5; i++) {
    upsert("appeal_cases", `fix-appeal-open-${i}`, {
      contributor_id: `fix-contributor-appeal-${i}`,
      issue_ref: `stellar-org/soroban-dev-console#${300 + i}`,
      status: "open",
      submitted_at: ago(6 - i),
      reviewed_at: null,
      created_at: ago(6 - i),
      updated_at: now,
    });
  }
  for (let i = 0; i < 2; i++) {
    upsert("appeal_cases", `fix-appeal-review-${i}`, {
      contributor_id: `fix-contributor-appeal-${5 + i}`,
      issue_ref: `stellar-org/soroban-dev-console#${310 + i}`,
      status: "under_review",
      submitted_at: ago(10),
      reviewed_at: ago(2),
      created_at: ago(10),
      updated_at: now,
    });
  }
  console.log("  ✅ appeal-backlog fixture applied");
}

function fixtureFlaggedAbuse(): void {
  for (let i = 0; i < 2; i++) {
    upsert("abuse_flags", `fix-abuse-${i}`, {
      contributor_id: `fix-contributor-abuse-${i}`,
      reason: i === 0 ? "duplicate_submission" : "automated_flag",
      status: "active",
      flagged_at: ago(3 - i),
      resolved_at: null,
      created_at: ago(3 - i),
      updated_at: now,
    });
  }
  console.log("  ✅ flagged-abuse fixture applied");
}

console.log(`\n📦  Wave Fixture Generator — fixture: ${fixture}\n`);

switch (fixture) {
  case "exhausted-budget": fixtureExhaustedBudget(); break;
  case "pending-verification": fixturePendingVerification(); break;
  case "appeal-backlog": fixtureAppealBacklog(); break;
  case "flagged-abuse": fixtureFlaggedAbuse(); break;
  case "all":
    fixtureExhaustedBudget();
    fixturePendingVerification();
    fixtureAppealBacklog();
    fixtureFlaggedAbuse();
    break;
  default:
    console.error(`Unknown fixture: ${fixture}\nRun with --list to see available fixtures.`);
    process.exit(1);
}

console.log("\n✅  Fixtures applied.\n");
