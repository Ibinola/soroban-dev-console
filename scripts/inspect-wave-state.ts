#!/usr/bin/env tsx
// scripts/inspect-wave-state.ts
// DX-202: CLI for inspecting budgets, reservations, and point ledgers.
//
// Provides a maintainer/CI-friendly view of Wave 5 operational state without
// requiring direct DB access or a running API server.
//
// Usage:
//   tsx scripts/inspect-wave-state.ts budgets [--org <id>] [--repo <id>]
//   tsx scripts/inspect-wave-state.ts ledger [--contributor <id>]
//   tsx scripts/inspect-wave-state.ts reservations [--status <status>]
//   tsx scripts/inspect-wave-state.ts summary
//   tsx scripts/inspect-wave-state.ts --db <path> <command>

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, "..");

// ── Args ──────────────────────────────────────────────────────────────────────
const raw = process.argv.slice(2);
let dbPath = path.join(ROOT, "apps/api/dev.db");
const positional: string[] = [];
const flags: Record<string, string> = {};

for (let i = 0; i < raw.length; i++) {
  if (raw[i].startsWith("--") && raw[i + 1] && !raw[i + 1].startsWith("--")) {
    flags[raw[i].slice(2)] = raw[++i];
  } else {
    positional.push(raw[i]);
  }
}

if (flags.db) dbPath = path.resolve(flags.db);
const command = positional[0] ?? "summary";

// ── DB ────────────────────────────────────────────────────────────────────────
if (!fs.existsSync(dbPath)) {
  console.error(`❌ Database not found: ${dbPath}`);
  process.exit(1);
}

let db: { prepare: (sql: string) => { all: () => unknown[]; get: () => unknown } };
try {
  const mod = await import("better-sqlite3");
  const Ctor = ((mod as Record<string, unknown>).default ?? mod) as (p: string) => typeof db;
  db = Ctor(dbPath);
} catch {
  console.error("❌ better-sqlite3 not installed. Run: npm install -g better-sqlite3");
  process.exit(1);
}

function query(sql: string): unknown[] {
  try {
    return db.prepare(sql).all();
  } catch {
    return [];
  }
}

function row(sql: string): unknown {
  try {
    return db.prepare(sql).get();
  } catch {
    return null;
  }
}

// ── Formatters ────────────────────────────────────────────────────────────────
function pct(used: number, cap: number): string {
  if (cap === 0) return "n/a";
  return `${Math.round((used / cap) * 100)}%`;
}

function headroom(cap: number, used: number, reserved: number): number {
  return Math.max(0, cap - used - reserved);
}

// ── Commands ──────────────────────────────────────────────────────────────────
function cmdBudgets(): void {
  let sql = "SELECT * FROM budget_scopes";
  const conditions: string[] = [];
  if (flags.org) conditions.push(`organization_id = '${flags.org}'`);
  if (flags.repo) conditions.push(`repo_id = '${flags.repo}'`);
  if (conditions.length) sql += " WHERE " + conditions.join(" AND ");

  const rows = query(sql) as Array<Record<string, unknown>>;
  if (rows.length === 0) {
    console.log("No budget scopes found.");
    return;
  }
  console.log("\nBudget Scopes\n");
  for (const r of rows) {
    const cap = Number(r.cap_points ?? 0);
    const used = Number(r.used_points ?? 0);
    const res = Number(r.reserved_points ?? 0);
    const hw = headroom(cap, used, res);
    const scope = r.repo_id ? `${r.organization_id}/${r.repo_id}` : r.organization_id;
    console.log(`  ${String(scope).padEnd(40)} cap=${cap}  used=${used} (${pct(used, cap)})  reserved=${res}  headroom=${hw}`);
  }
  console.log();
}

function cmdLedger(): void {
  let sql = "SELECT contributor_id, SUM(points) as total, COUNT(*) as entries FROM point_ledger_entries";
  if (flags.contributor) sql += ` WHERE contributor_id = '${flags.contributor}'`;
  sql += " GROUP BY contributor_id ORDER BY total DESC LIMIT 50";

  const rows = query(sql) as Array<Record<string, unknown>>;
  if (rows.length === 0) {
    console.log("No ledger entries found.");
    return;
  }
  console.log("\nPoint Ledger Balances\n");
  console.log("  Contributor".padEnd(36) + "  Balance  Entries");
  console.log("  " + "─".repeat(56));
  for (const r of rows) {
    const id = String(r.contributor_id).slice(0, 32).padEnd(34);
    const total = String(r.total).padStart(7);
    const entries = String(r.entries).padStart(7);
    console.log(`  ${id}  ${total}  ${entries}`);
  }
  console.log();
}

function cmdReservations(): void {
  let sql = "SELECT * FROM budget_reservations";
  if (flags.status) sql += ` WHERE status = '${flags.status}'`;
  sql += " ORDER BY created_at DESC LIMIT 50";

  const rows = query(sql) as Array<Record<string, unknown>>;
  if (rows.length === 0) {
    console.log("No reservations found.");
    return;
  }
  console.log("\nBudget Reservations\n");
  for (const r of rows) {
    console.log(`  [${r.status}]  ${r.issue_ref}  pts=${r.points}  created=${String(r.created_at).slice(0, 10)}`);
  }
  console.log();
}

function cmdSummary(): void {
  const budgetCount = (row("SELECT COUNT(*) as n FROM budget_scopes") as { n: number } | null)?.n ?? "n/a";
  const resCount = (row("SELECT COUNT(*) as n FROM budget_reservations WHERE status = 'active'") as { n: number } | null)?.n ?? "n/a";
  const ledgerCount = (row("SELECT COUNT(DISTINCT contributor_id) as n FROM point_ledger_entries") as { n: number } | null)?.n ?? "n/a";
  const appealOpen = (row("SELECT COUNT(*) as n FROM appeal_cases WHERE status = 'open'") as { n: number } | null)?.n ?? "n/a";
  const verPending = (row("SELECT COUNT(*) as n FROM contributor_verifications WHERE status = 'pending'") as { n: number } | null)?.n ?? "n/a";

  console.log("\nWave 5 State Summary\n");
  console.log(`  Budget scopes:          ${budgetCount}`);
  console.log(`  Active reservations:    ${resCount}`);
  console.log(`  Contributors w/ points: ${ledgerCount}`);
  console.log(`  Open appeals:           ${appealOpen}`);
  console.log(`  Pending verifications:  ${verPending}`);
  console.log();
  console.log("  Run sub-commands for detail:");
  console.log("    tsx scripts/inspect-wave-state.ts budgets");
  console.log("    tsx scripts/inspect-wave-state.ts ledger");
  console.log("    tsx scripts/inspect-wave-state.ts reservations");
  console.log();
}

switch (command) {
  case "budgets": cmdBudgets(); break;
  case "ledger": cmdLedger(); break;
  case "reservations": cmdReservations(); break;
  case "summary": cmdSummary(); break;
  default:
    console.error(`Unknown command: ${command}`);
    console.error("Use: budgets | ledger | reservations | summary");
    process.exit(1);
}
