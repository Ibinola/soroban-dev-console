/**
 * Issue #495 (BE-326): Reconcile point ledger adjustments
 *
 * Problem: PointLedgerService has verifyIntegrity() that detects
 * mismatches between raw entries and snapshots, but no automated
 * repair path. Adjustments and reversals require manual tracing.
 *
 * Solution: Add a full reconciliation pipeline: detect mismatches,
 * generate correction entries, repair snapshots, and produce an
 * audit trail for every adjustment.
 */

// ---- FIXED: point-ledger.service.ts — reconciliation pipeline ----

export interface ReconciliationResult {
  checkedAt: string;
  totalContributors: number;
  mismatchesFound: number;
  correctionsApplied: number;
  corrections: Array<{
    contributorId: string;
    previousBalance: number;
    computedBalance: number;
    delta: number;
    correctionEntryId: string;
  }>;
  ok: boolean;
}

@Injectable()
export class PointLedgerService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async reconcile(): Promise<ReconciliationResult> {
    const corrections: ReconciliationResult["corrections"] = [];

    // 1. Compute expected balances from raw entries
    const entries = await this.prisma.pointLedgerEntry.findMany({
      select: { contributorId: true, points: true },
    });

    const computed = new Map<string, number>();
    for (const e of entries) {
      computed.set(e.contributorId, (computed.get(e.contributorId) ?? 0) + e.points);
    }

    // 2. Compare against snapshots
    const snapshots = await this.prisma.pointLedgerSnapshot.findMany();
    const snapshotMap = new Map(snapshots.map((s) => [s.contributorId, s]));

    const allContributors = new Set([
      ...computed.keys(),
      ...snapshotMap.keys(),
    ]);

    for (const contributorId of allContributors) {
      const expected = computed.get(contributorId) ?? 0;
      const snapshot = snapshotMap.get(contributorId);
      const recorded = snapshot?.totalPoints ?? 0;

      if (expected !== recorded) {
        const delta = expected - recorded;

        // 3. Generate a correction entry
        const correctionEntry = await this.prisma.pointLedgerEntry.create({
          data: {
            contributorId,
            eventType: "reconciliation",
            points: delta,
            referenceId: `reconciliation-${Date.now()}`,
          },
        });

        // 4. Repair the snapshot
        await this.prisma.pointLedgerSnapshot.upsert({
          where: { contributorId },
          update: {
            totalPoints: expected,
            repairedAt: new Date(),
          },
          create: {
            contributorId,
            totalPoints: expected,
            repairedAt: new Date(),
          },
        });

        corrections.push({
          contributorId,
          previousBalance: recorded,
          computedBalance: expected,
          delta,
          correctionEntryId: correctionEntry.id,
        });
      }
    }

    // 5. Audit trail
    if (corrections.length > 0) {
      await this.audit.log({
        actor: "system:point-ledger",
        action: "point_ledger.reconciled",
        resourceType: "point_ledger",
        resourceId: `reconciliation-${Date.now()}`,
        summary: `Reconciled ${corrections.length} mismatched contributor balances`,
        metadata: { correctionCount: corrections.length, totalDelta: corrections.reduce((s, c) => s + c.delta, 0) },
      });
    }

    return {
      checkedAt: new Date().toISOString(),
      totalContributors: allContributors.size,
      mismatchesFound: corrections.length,
      correctionsApplied: corrections.length,
      corrections,
      ok: corrections.length === 0,
    };
  }

  /** Reverse a specific ledger entry by creating a counter-entry. */
  async reverseEntry(entryId: string, reason: string): Promise<void> {
    const entry = await this.prisma.pointLedgerEntry.findUnique({ where: { id: entryId } });
    if (!entry) throw new NotFoundException("Ledger entry not found");

    // Create a counter-entry with negative points
    await this.prisma.pointLedgerEntry.create({
      data: {
        contributorId: entry.contributorId,
        eventType: "reversal",
        points: -entry.points,
        referenceId: `reversal-${entryId}`,
      },
    });

    await this.audit.log({
      actor: "system:point-ledger",
      action: "point_ledger.entry_reversed",
      resourceType: "point_ledger",
      resourceId: entryId,
      summary: `Entry ${entryId} reversed: ${entry.points} → 0`,
      metadata: { reason, originalEntry: entry.id, originalPoints: entry.points },
    });
  }

  /** Adjust a contributor's balance with an explicit reason. */
  async adjustBalance(contributorId: string, delta: number, reason: string): Promise<void> {
    if (delta === 0) return;

    await this.prisma.pointLedgerEntry.create({
      data: {
        contributorId,
        eventType: "manual_adjustment",
        points: delta,
        referenceId: `adjustment-${Date.now()}`,
      },
    });

    // Update snapshot
    const snapshot = await this.prisma.pointLedgerSnapshot.findUnique({
      where: { contributorId },
    });
    const newTotal = (snapshot?.totalPoints ?? 0) + delta;

    await this.prisma.pointLedgerSnapshot.upsert({
      where: { contributorId },
      update: { totalPoints: newTotal, repairedAt: new Date() },
      create: { contributorId, totalPoints: newTotal, repairedAt: new Date() },
    });

    await this.audit.log({
      actor: "system:point-ledger",
      action: "point_ledger.balance_adjusted",
      resourceType: "point_ledger",
      resourceId: contributorId,
      summary: `Balance adjusted by ${delta} for ${contributorId}`,
      metadata: { delta, reason, newTotal },
    });
  }
}
