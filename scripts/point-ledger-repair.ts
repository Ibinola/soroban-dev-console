#!/usr/bin/env tsx
/**
 * BE-214: Point-ledger integrity verifier and repair utility.
 *
 * Usage:
 *   npx tsx scripts/point-ledger-repair.ts [--dry-run]
 *
 * Recomputes expected point totals from raw ledger entries and repairs
 * any snapshot mismatches. Pass --dry-run to report without writing.
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const dryRun = process.argv.includes("--dry-run");

async function main() {
  console.log(`[point-ledger-repair] Starting integrity check (dry-run=${dryRun})`);

  const entries = await prisma.pointLedgerEntry.findMany({
    select: { contributorId: true, points: true },
  });

  const expected = new Map<string, number>();
  for (const e of entries) {
    expected.set(e.contributorId, (expected.get(e.contributorId) ?? 0) + e.points);
  }

  const snapshots = await prisma.pointLedgerSnapshot.findMany({
    select: { contributorId: true, totalPoints: true },
  });

  const mismatches: Array<{ contributorId: string; expected: number; recorded: number }> = [];
  for (const snap of snapshots) {
    const computed = expected.get(snap.contributorId) ?? 0;
    if (computed !== snap.totalPoints) {
      mismatches.push({ contributorId: snap.contributorId, expected: computed, recorded: snap.totalPoints });
    }
  }

  if (mismatches.length === 0) {
    console.log("[point-ledger-repair] All snapshots are consistent. Nothing to repair.");
    return;
  }

  console.log(`[point-ledger-repair] Found ${mismatches.length} mismatch(es):`);
  for (const m of mismatches) {
    console.log(`  contributor=${m.contributorId}  expected=${m.expected}  recorded=${m.recorded}  delta=${m.expected - m.recorded}`);
  }

  if (dryRun) {
    console.log("[point-ledger-repair] Dry-run mode — no changes written.");
    return;
  }

  for (const m of mismatches) {
    await prisma.pointLedgerSnapshot.upsert({
      where: { contributorId: m.contributorId },
      create: { contributorId: m.contributorId, totalPoints: m.expected },
      update: { totalPoints: m.expected, repairedAt: new Date() },
    });
  }

  await prisma.auditLog.create({
    data: {
      actor: "system:repair-script",
      action: "point_ledger.integrity.repaired",
      resourceType: "point_ledger",
      resourceId: "global",
      summary: `Repaired ${mismatches.length} snapshot(s) via CLI script`,
      metadata: { mismatches },
    },
  });

  console.log(`[point-ledger-repair] Repaired ${mismatches.length} snapshot(s).`);
}

main()
  .catch((err) => { console.error(err); process.exit(1); })
  .finally(() => prisma.$disconnect());
