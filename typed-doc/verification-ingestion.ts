/**
 * Issue #492 (BE-323): Persist verification event ingestion cleanly
 *
 * Problem: VerificationService.ingest() does basic idempotent writes but
 * lacks a durable ingestion path — no retry queue, no replay, no
 * dead-letter handling for failed events.
 *
 * Solution: Integrate with BackgroundJobService for durable ingestion.
 * Events that fail validation are dead-lettered; transient failures
 * are retried via the job queue with idempotent replay.
 */

// ---- FIXED: verification.service.ts additions ----
import { BackgroundJobService } from "../../lib/background-job.service.js";
import { QUEUES } from "../jobs/constants/queues.js";

@Injectable()
export class VerificationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly events: DomainEventBus,
    private readonly jobs: BackgroundJobService,
  ) {}

  async ingest(payload: VerificationEventPayload): Promise<VerificationEventResult> {
    // 1. Idempotency check (existing logic)
    const existing = await this.prisma.verificationEvent.findUnique({
      where: { eventId: payload.eventId },
    });
    if (existing) return this.toResult(existing);

    // 2. Validate payload before writing
    if (!this.isValid(payload)) {
      // Dead-letter invalid events immediately
      await this.jobs.enqueue({
        type: "verification.ingest_failed",
        payload: { eventId: payload.eventId, reason: "invalid payload", ...payload },
        queue: QUEUES.DEAD_LETTER,
        maxAttempts: 1,
      });
      throw new BadRequestException("Invalid verification event payload");
    }

    // 3. Write via background job for durability + replay
    const job = await this.jobs.enqueue({
      type: "verification.ingest",
      payload: payload as unknown as Record<string, unknown>,
      queue: QUEUES.VERIFICATION,
      maxAttempts: 3,
    });

    // 4. Return immediately — the job processor completes the write
    return {
      id: job.id,
      eventId: payload.eventId,
      status: "pending",
      ingestedAt: job.createdAt.toISOString(),
    };
  }

  /** Idempotent replay of a single event. */
  async replay(eventId: string): Promise<VerificationEventResult> {
    const existing = await this.prisma.verificationEvent.findUnique({
      where: { eventId },
    });
    if (!existing) throw new NotFoundException(`Event ${eventId} not found`);

    await this.jobs.enqueue({
      type: "verification.replay",
      payload: { eventId, contributorId: existing.contributorId, provider: existing.provider },
      queue: QUEUES.VERIFICATION,
      maxAttempts: 3,
    });

    return this.toResult(existing);
  }

  /** Get ingestion stats for the admin dashboard. */
  async getStats(): Promise<{ total: number; byStatus: Record<string, number>; deadLettered: number }> {
    const total = await this.prisma.verificationEvent.count();
    const byStatusRaw = await this.prisma.verificationEvent.groupBy({
      by: ["status"],
      _count: { id: true },
    });
    const byStatus: Record<string, number> = {};
    for (const r of byStatusRaw) byStatus[r.status] = r._count.id;

    const deadLettered = await this.prisma.backgroundJob.count({
      where: { type: "verification.ingest_failed", status: "dead" },
    });

    return { total, byStatus, deadLettered };
  }

  private isValid(payload: VerificationEventPayload): boolean {
    return !!(payload.eventId && payload.contributorId && payload.provider);
  }
}

// ---- Prisma schema: add status field to track ingestion state ----
model VerificationEvent {
  id            String   @id @default(cuid())
  eventId       String   @unique @map("event_id")
  contributorId String   @map("contributor_id")
  provider      String
  status        String   @default("pending")  // pending | verified | failed | replayed
  verifiedAt    DateTime? @map("verified_at")
  metadata      Json?
  processedAt   DateTime @default(now()) @map("processed_at")

  @@index([contributorId])
  @@index([provider, status])
  @@map("verification_events")
}
