#!/usr/bin/env tsx
// scripts/replay-packs/abuse-investigation.ts
// DX-208: Scenario replay pack — abuse investigation.
//
// Seeds the local database with the state of a suspected abuse pattern
// (duplicate submissions, automated farming) so engineers can walk through
// the detection and resolution steps.
//
// Usage:
//   tsx scripts/replay-packs/abuse-investigation.ts [--db <path>] [--contributor <id>]

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, "../..");

const args = process.argv.slice(2);
let dbPath = path.join(ROOT, "apps/api/dev.db");
let contributorId = "replay-contributor-abuse";

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

console.log("\n🔍  Abuse Investigation Replay Pack\n");
console.log(`Contributor: ${contributorId}\n`);

// 1. Multiple rapid reservations on the same issue from two accounts
for (let i = 0; i < 3; i++) {
  upsert("budget_reservations", `replay-abuse-reservation-${i}`, {
    scope_id: "replay-abuse-scope",
    issue_ref: "replay-org/replay-repo#200",
    contributor_id: i === 0 ? contributorId : `${contributorId}-alt-${i}`,
    points: 50,
    status: i === 0 ? "active" : "cancelled",
    created_at: ago(5),
    updated_at: ago(5 - i),
  });
}
console.log("  [1/4] Rapid duplicate reservations on #200 from 3 accounts (1 active, 2 cancelled)");

// 2. Abuse flag raised by automated detection
upsert("abuse_flags", `replay-abuse-flag-${contributorId}`, {
  contributor_id: contributorId,
  reason: "duplicate_reservation_pattern",
  status: "active",
  flagged_at: ago(4),
  resolved_at: null,
  created_at: ago(4),
  updated_at: now,
});
console.log("  [2/4] Abuse flag seeded: duplicate_reservation_pattern, active");

// 3. Verification still pending for the contributor
upsert("contributor_verifications", `replay-abuse-ver-${contributorId}`, {
  contributor_id: contributorId,
  status: "pending",
  submitted_at: ago(6),
  reviewed_at: null,
  created_at: ago(6),
  updated_at: now,
});
console.log("  [3/4] Verification seeded: pending (submitted before flag)");

// 4. Point ledger shows unusually high point accumulation in short window
for (let i = 0; i < 5; i++) {
  upsert("point_ledger_entries", `replay-abuse-ledger-${contributorId}-${i}`, {
    contributor_id: contributorId,
    event_type: "review_approved",
    points: 100,
    reference_id: `replay-org/replay-repo#${190 + i}`,
    created_at: ago(7 - i),
  });
}
console.log("  [4/4] Ledger seeded: 5 × 100-pt approvals in 7-day window\n");

console.log("Replay complete. Inspect the state:\n");
console.log("  tsx scripts/explore-seed-data.ts --table abuse_flags");
console.log("  tsx scripts/explore-seed-data.ts --table budget_reservations");
console.log("  tsx scripts/explore-seed-data.ts --table contributor_verifications");
console.log("  tsx scripts/explore-seed-data.ts --table point_ledger_entries");
console.log();
console.log("Expected investigation questions:");
console.log("  1. Were the duplicate reservations from the same IP or wallet?");
console.log("  2. Is the point accumulation rate consistent with legitimate contributions?");
console.log("  3. Did the contributor submit verification before or after the flag?");
console.log("  4. Should the active reservation be suspended pending verification?\n");
