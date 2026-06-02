/**
 * BE-216: Harden background job execution for retries, idempotency, and partial failure.
 *
 * Jobs are persisted in the DB. Each execution attempt:
 * - Claims the job with a lock to prevent concurrent processing
 * - Increments attempt count
 * - Marks completed or failed with structured error
 * - Respects maxAttempts before marking permanently failed
 *
 * INFRA-212: Worker concurrency is controlled via WORKER_CONCURRENCY env var
 * (default: 3). This caps how many jobs a single process claims simultaneously,
 * preventing resource exhaustion under Wave 5 load spikes.
 */

import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Prisma } from "@prisma/client";
import { AuditService } from "./audit.service.js";
import { PrismaService } from "./prisma.service.js";

export type JobStatus = "pending" | "running" | "completed" | "failed" | "dead";

export interface EnqueueJobOptions {
  type: string;
  payload: Record<string, unknown>;
  maxAttempts?: number;
  /** ISO string or Date for deferred execution */
  scheduledAt?: string | Date;
}

export interface JobRecord {
  id: string;
  type: string;
  status: string;
  attempts: number;
  maxAttempts: number;
  lastError: string | null;
  scheduledAt: Date;
  completedAt: Date | null;
  createdAt: Date;
}

@Injectable()
export class BackgroundJobService {
  private readonly logger = new Logger(BackgroundJobService.name);
  /** Lock duration in milliseconds — prevents double-processing under concurrent workers */
  private readonly LOCK_DURATION_MS = 30_000;
  /**
   * INFRA-212: Max concurrent jobs claimed by this process.
   * Read from WORKER_CONCURRENCY env var; default 3 for Wave 5 stability.
   */
  readonly concurrency: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly config?: ConfigService,
  ) {
    const raw = this.config?.get<string>("WORKER_CONCURRENCY");
    const parsed = raw ? parseInt(raw, 10) : NaN;
    this.concurrency = Number.isFinite(parsed) && parsed > 0 ? parsed : 3;
  }

  async enqueue(options: EnqueueJobOptions): Promise<JobRecord> {
    const record = await this.prisma.backgroundJob.create({
      data: {
        type: options.type,
        status: "pending",
        payload: options.payload as Prisma.InputJsonValue,
        maxAttempts: options.maxAttempts ?? 3,
        scheduledAt: options.scheduledAt ? new Date(options.scheduledAt) : new Date(),
      },
    });
    this.logger.debug(`Enqueued job ${record.id} (${record.type})`);
    await this.audit.log({
      actor: "system:background-jobs",
      action: "job.enqueued",
      resourceType: "background_job",
      resourceId: record.id,
      summary: `Enqueued ${record.type} job`,
      metadata: { type: record.type, maxAttempts: record.maxAttempts },
    });
    return record;
  }

  /**
   * Claim the next pending job of a given type.
   * Returns null if no job is available or all are locked.
   */
  async claimNext(type: string): Promise<JobRecord | null> {
    const now = new Date();
    const lockUntil = new Date(now.getTime() + this.LOCK_DURATION_MS);

    // Find a claimable job: pending/failed with attempts < maxAttempts and not locked
    const candidate = await this.prisma.backgroundJob.findFirst({
      where: {
        type,
        status: { in: ["pending", "failed"] },
        scheduledAt: { lte: now },
        attempts: { lt: this.prisma.backgroundJob.fields.maxAttempts as any },
        OR: [{ lockedUntil: null }, { lockedUntil: { lte: now } }],
      },
      orderBy: { scheduledAt: "asc" },
    });

    if (!candidate) return null;

    // Atomic claim via conditional update
    const updated = await this.prisma.backgroundJob.updateMany({
      where: {
        id: candidate.id,
        status: { in: ["pending", "failed"] },
        OR: [{ lockedUntil: null }, { lockedUntil: { lte: now } }],
      },
      data: {
        status: "running",
        attempts: { increment: 1 },
        lockedUntil: lockUntil,
      },
    });

    if (updated.count === 0) {
      // Another worker claimed it first
      return null;
    }

    this.logger.debug(`Claimed job ${candidate.id} (${candidate.type})`);
    return this.prisma.backgroundJob.findUnique({ where: { id: candidate.id } }) as Promise<JobRecord>;
  }

  async complete(id: string): Promise<void> {
    await this.prisma.backgroundJob.update({
      where: { id },
      data: {
        status: "completed",
        completedAt: new Date(),
        lockedUntil: null,
        lastError: null,
      },
    });
    this.logger.debug(`Job ${id} completed`);
    await this.audit.log({
      actor: "system:background-jobs",
      action: "job.completed",
      resourceType: "background_job",
      resourceId: id,
      summary: "Background job completed",
    });
  }

  async fail(id: string, error: string): Promise<void> {
    const job = await this.prisma.backgroundJob.findUnique({ where: { id } });
    if (!job) return;

    const isDead = job.attempts >= job.maxAttempts;
    await this.prisma.backgroundJob.update({
      where: { id },
      data: {
        status: isDead ? "dead" : "failed",
        lastError: error,
        lockedUntil: null,
      },
    });
    this.logger.warn(`Job ${id} ${isDead ? "dead (max attempts)" : "failed"}: ${error}`);
    await this.audit.log({
      actor: "system:background-jobs",
      action: isDead ? "job.dead" : "job.failed",
      resourceType: "background_job",
      resourceId: id,
      summary: isDead ? "Background job exhausted retries" : "Background job failed",
      metadata: { error },
    });
  }

  async replay(id: string): Promise<JobRecord | null> {
    const job = await this.prisma.backgroundJob.findUnique({ where: { id } });
    if (!job || job.status !== "dead") return null;

    await this.prisma.backgroundJob.update({
      where: { id },
      data: {
        status: "pending",
        attempts: 0,
        lastError: null,
        lockedUntil: null,
        scheduledAt: new Date(),
      },
    });

    await this.audit.log({
      actor: "system:background-jobs",
      action: "job.replayed",
      resourceType: "background_job",
      resourceId: id,
      summary: "Background job returned to the pending queue",
    });

    return this.prisma.backgroundJob.findUnique({ where: { id } }) as Promise<JobRecord>;
  }

  async findByStatus(status: JobStatus, limit = 50): Promise<JobRecord[]> {
    return this.prisma.backgroundJob.findMany({
      where: { status },
      orderBy: { scheduledAt: "asc" },
      take: limit,
    }) as Promise<JobRecord[]>;
  }

  async getStats(): Promise<Record<JobStatus, number>> {
    const counts = await this.prisma.backgroundJob.groupBy({
      by: ["status"],
      _count: { id: true },
    });
    const stats: Record<string, number> = {
      pending: 0, running: 0, completed: 0, failed: 0, dead: 0,
    };
    for (const row of counts) {
      stats[row.status] = row._count.id;
    }
    return stats as Record<JobStatus, number>;
  }

  /** INFRA-212: Returns current worker configuration for operator visibility. */
  getWorkerConfig(): { concurrency: number } {
    return { concurrency: this.concurrency };
  }
}
