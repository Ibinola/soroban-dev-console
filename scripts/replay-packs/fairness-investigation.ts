#!/usr/bin/env tsx
// scripts/replay-packs/fairness-investigation.ts
// DX-208: Scenario replay pack — fairness investigation.
//
// Reconstructs a suspicious fairness workflow locally from captured operational
// context so engineers can diagnose without live data access.
//
// Usage:
//   tsx scripts/replay-packs/fairness-investigation.ts [--db <path>] [--contributor <id>]

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, "../..");

const args = process.argv.slice(2);
let dbPath = path.join(ROOT, "apps/api/dev.db");
let contributorId = "replay-contributor-fairness";

for (let i = 0; i < args.length; i++) {
  if (args[i] === "--db" && args[i + 1]) dbPath = path.resolve(args[++i]);
  if (args[i] === "--contributor" && args[i + 1]) contributorId = args[++i];
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
    // Table may not exist
  }
}

// ── Replay: unfair budget rejection during near-exhaustion ────────────────────
console.log("\n🔍  Fairness Investigation Replay Pack\n");
console.log(`Contributor: ${contributorId}\n`);

// 1. Set up a near-exhausted repo scope
upsert("budget_scopes", "replay-fairness-scope", {
  organization_id: "replay-org",
  repo_id: "replay-repo",
  cap_points: 200,
  used_points: 190,
  reserved_points: 5,
  created_at: ago(30),
  updated_at: ago(1),
});
console.log("  [1/5] Budget scope seeded: 190/200 used, 5 reserved → headroom=5");

// 2. Contributor had a valid reservation that was cancelled
upsert("budget_reservations", "replay-reservation-cancelled", {
  scope_id: "replay-fairness-scope",
  issue_ref: "replay-org/replay-repo#99",
  contributor_id: contributorId,
  points: 5,
  status: "cancelled",
  created_at: ago(10),
  updated_at: ago(9),
});
console.log("  [2/5] Reservation #99 seeded: 5 pts, cancelled after budget pressure");

// 3. Contributor's verification was approved after the cancellation
upsert("contributor_verifications", `replay-ver-${contributorId}`, {
  contributor_id: contributorId,
  status: "approved",
  submitted_at: ago(15),
  reviewed_at: ago(5),
  created_at: ago(15),
  updated_at: ago(5),
});
console.log("  [3/5] Verification seeded: approved (after reservation cancelled)");

// 4. Appeal was submitted
upsert("appeal_cases", `replay-appeal-fairness-${contributorId}`, {
  contributor_id: contributorId,
  issue_ref: "replay-org/replay-repo#99",
  status: "open",
  reason: "Reservation cancelled during budget pressure despite approved verification",
  submitted_at: ago(3),
  reviewed_at: null,
  created_at: ago(3),
  updated_at: now,
});
console.log("  [4/5] Appeal seeded: open, citing unfair cancellation timing");

// 5. Point ledger shows no credit for the cancelled issue
upsert("point_ledger_entries", `replay-ledger-${contributorId}-1`, {
  contributor_id: contributorId,
  event_type: "review_approved",
  points: 50,
  reference_id: "replay-org/replay-repo#97",
  created_at: ago(20),
});
console.log("  [5/5] Ledger seeded: prior approved entry (no credit for #99)\n");

console.log("Replay complete. Inspect the state:\n");
console.log(`  tsx scripts/explore-seed-data.ts --table budget_scopes`);
console.log(`  tsx scripts/explore-seed-data.ts --table budget_reservations`);
console.log(`  tsx scripts/explore-seed-data.ts --table appeal_cases`);
console.log(`  tsx scripts/explore-seed-data.ts --table point_ledger_entries`);
console.log();
console.log("Expected investigation questions:");
console.log("  1. Was the cancellation within policy (budget exhausted at time of cancellation)?");
console.log("  2. Was the contributor verified before the reservation was created?");
console.log("  3. Was headroom > 0 when the reservation was first accepted?");
console.log("  4. Was the contributor notified of the cancellation?\n");
