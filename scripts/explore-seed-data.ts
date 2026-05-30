#!/usr/bin/env tsx
// scripts/explore-seed-data.ts
// DX-212: Seed-data explorer for local debugging.
//
// Reads the local SQLite database and prints a human-readable summary of
// workspaces, contracts, interactions, artifacts, point ledger entries,
// budget states, and verification records without opening a DB GUI.
//
// Usage:
//   tsx scripts/explore-seed-data.ts [--db <path>] [--json] [--table <name>]

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, "..");

// ── Argument parsing ──────────────────────────────────────────────────────────
const args = process.argv.slice(2);
let dbPath = path.join(ROOT, "apps/api/dev.db");
let jsonOutput = false;
let tableFilter: string | null = null;

for (let i = 0; i < args.length; i++) {
  if (args[i] === "--db" && args[i + 1]) {
    dbPath = path.resolve(args[++i]);
  } else if (args[i] === "--json") {
    jsonOutput = true;
  } else if (args[i] === "--table" && args[i + 1]) {
    tableFilter = args[++i];
  }
}

// ── Database existence check ──────────────────────────────────────────────────
if (!fs.existsSync(dbPath)) {
  console.error(`❌  Database not found at: ${dbPath}`);
  console.error("    Run the API once or execute: npx prisma db push --prefix apps/api");
  process.exit(1);
}

// ── SQLite via better-sqlite3 or fallback message ────────────────────────────
let Database: unknown;
try {
  const mod = await import("better-sqlite3");
  Database = (mod as { default: unknown }).default ?? mod;
} catch {
  console.error("❌  better-sqlite3 not installed.");
  console.error("    Install it: npm install -g better-sqlite3");
  console.error("");
  console.error("    Alternatively, inspect the database directly:");
  console.error(`      sqlite3 ${dbPath}`);
  process.exit(1);
}

const db = (Database as (path: string) => unknown)(dbPath) as {
  prepare: (sql: string) => { all: () => unknown[] };
};

// ── Helpers ───────────────────────────────────────────────────────────────────
function section(title: string): void {
  if (!jsonOutput) {
    console.log("");
    console.log(`${"─".repeat(60)}`);
    console.log(`  ${title}`);
    console.log(`${"─".repeat(60)}`);
  }
}

function printTable(rows: unknown[]): void {
  if (rows.length === 0) {
    console.log("  (empty)");
    return;
  }
  if (jsonOutput) {
    console.log(JSON.stringify(rows, null, 2));
    return;
  }
  const keys = Object.keys(rows[0] as Record<string, unknown>);
  const widths = keys.map((k) =>
    Math.max(k.length, ...rows.map((r) => String((r as Record<string, unknown>)[k] ?? "").length)),
  );
  const header = keys.map((k, i) => k.padEnd(widths[i])).join("  ");
  const divider = widths.map((w) => "─".repeat(w)).join("  ");
  console.log("  " + header);
  console.log("  " + divider);
  for (const row of rows) {
    console.log(
      "  " +
        keys.map((k, i) => String((row as Record<string, unknown>)[k] ?? "").padEnd(widths[i])).join("  "),
    );
  }
}

function queryTable(tableName: string): unknown[] {
  try {
    return db.prepare(`SELECT * FROM ${tableName} LIMIT 100`).all();
  } catch {
    return [];
  }
}

// ── Tables to explore ─────────────────────────────────────────────────────────
const TABLES: Array<{ name: string; label: string }> = [
  { name: "workspaces", label: "Workspaces" },
  { name: "saved_contracts", label: "Saved Contracts" },
  { name: "saved_interactions", label: "Saved Interactions" },
  { name: "workspace_artifacts", label: "Workspace Artifacts" },
  { name: "share_links", label: "Share Links" },
  { name: "audit_logs", label: "Audit Logs (last 100)" },
  { name: "point_ledger_entries", label: "Point Ledger Entries" },
  { name: "budget_scopes", label: "Budget Scopes" },
  { name: "budget_reservations", label: "Budget Reservations" },
  { name: "contributor_verifications", label: "Contributor Verifications" },
  { name: "appeal_cases", label: "Appeal Cases" },
  { name: "review_windows", label: "Review Windows" },
];

// ── Main ──────────────────────────────────────────────────────────────────────
if (!jsonOutput) {
  console.log("");
  console.log("╔════════════════════════════════════════════════════════════╗");
  console.log("║       Soroban DevConsole — Seed Data Explorer             ║");
  console.log(`║  DB: ${dbPath.padEnd(54)}║`);
  console.log("╚════════════════════════════════════════════════════════════╝");
}

const results: Record<string, unknown[]> = {};
for (const { name, label } of TABLES) {
  if (tableFilter && tableFilter !== name) continue;
  const rows = queryTable(name);
  results[name] = rows;
  if (!jsonOutput) {
    section(`${label} (${rows.length} rows)`);
    printTable(rows);
  }
}

if (jsonOutput) {
  console.log(JSON.stringify(results, null, 2));
} else {
  console.log("");
  console.log("✅  Exploration complete.");
  console.log(`    Database: ${dbPath}`);
  console.log("    Use --json for machine-readable output.");
  console.log("    Use --table <name> to filter to one table.");
  console.log("");
}
