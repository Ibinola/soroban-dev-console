/**
 * BE-216: Harden background job execution for retries, idempotency, and partial failure.
 *
 * Jobs are persisted in the DB. Each execution attempt:
 * - Claims the job with a lock to prevent concurrent processing
 * - Increments attempt count
 * - Marks completed or failed with structured error
 * - Respects maxAttempts before marking permanently failed
 */

import { Injectable, Logger } from "@nestjs/common";
import { Prisma } from "@prisma/client";
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

  constructor(private readonly prisma: PrismaService) {}

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
}
