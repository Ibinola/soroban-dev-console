import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { MapDbErrors } from "../../lib/db-error.mapper.js";
import { AuditService } from "../../lib/audit.service.js";
import { PrismaService } from "../../lib/prisma.service.js";

export interface LedgerEntry {
  contributorId: string;
  eventType: string;
  points: number;
  referenceId?: string;
}

export interface IntegrityReport {
  checkedAt: string;
  totalEntries: number;
  mismatches: Array<{
    contributorId: string;
    expectedTotal: number;
    recordedTotal: number;
    delta: number;
  }>;
  ok: boolean;
}

@Injectable()
export class PointLedgerService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  @MapDbErrors()
  async addEntry(entry: LedgerEntry): Promise<void> {
    await this.prisma.pointLedgerEntry.create({
      data: {
        contributorId: entry.contributorId,
        eventType: entry.eventType,
        points: entry.points,
        referenceId: entry.referenceId ?? null,
      },
    });
  }

  @MapDbErrors()
  async getBalance(contributorId: string): Promise<number> {
    const result = await this.prisma.pointLedgerEntry.aggregate({
      where: { contributorId },
      _sum: { points: true },
    });
    return result._sum.points ?? 0;
  }

  @MapDbErrors()
  async verifyIntegrity(): Promise<IntegrityReport> {
    const entries = await this.prisma.pointLedgerEntry.findMany({
      select: { contributorId: true, points: true },
    });

    // Compute expected totals from raw entries
    const expected = new Map<string, number>();
    for (const e of entries) {
      expected.set(e.contributorId, (expected.get(e.contributorId) ?? 0) + e.points);
    }

    // Compare against point_ledger_snapshots if any exist
    const snapshots = await this.prisma.pointLedgerSnapshot.findMany({
      select: { contributorId: true, totalPoints: true },
    });

    const mismatches: IntegrityReport["mismatches"] = [];
    for (const snap of snapshots) {
      const computed = expected.get(snap.contributorId) ?? 0;
      if (computed !== snap.totalPoints) {
        mismatches.push({
          contributorId: snap.contributorId,
          expectedTotal: computed,
          recordedTotal: snap.totalPoints,
          delta: computed - snap.totalPoints,
        });
      }
    }

    const report: IntegrityReport = {
      checkedAt: new Date().toISOString(),
      totalEntries: entries.length,
      mismatches,
      ok: mismatches.length === 0,
    };

    void this.audit.log({
      actor: "system",
      action: "point_ledger.integrity.verified",
      resourceType: "point_ledger",
      resourceId: "global",
      summary: `Integrity check: ${mismatches.length} mismatch(es) found`,
      metadata: report as unknown as Prisma.InputJsonValue,
    });

    return report;
  }

  @MapDbErrors()
  async repair(): Promise<{ repairedCount: number }> {
    const report = await this.verifyIntegrity();
    let repairedCount = 0;

    for (const mismatch of report.mismatches) {
      await this.prisma.pointLedgerSnapshot.upsert({
        where: { contributorId: mismatch.contributorId },
        create: {
          contributorId: mismatch.contributorId,
          totalPoints: mismatch.expectedTotal,
        },
        update: { totalPoints: mismatch.expectedTotal, repairedAt: new Date() },
      });
      repairedCount++;
    }

    void this.audit.log({
      actor: "system",
      action: "point_ledger.integrity.repaired",
      resourceType: "point_ledger",
      resourceId: "global",
      summary: `Repaired ${repairedCount} snapshot(s)`,
    });

    return { repairedCount };
  }
}
