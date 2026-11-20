import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../lib/prisma.service.js";
import { DomainEventBus } from "../../lib/domain-event-bus.js";
import { normalizePagination, toPaginatedEnvelope } from "../../lib/pagination.js";

export interface EnqueueJobDto {
  jobType: string;
  payload: Prisma.InputJsonValue;
  error?: string;
  maxRetries?: number;
}

export interface DeadLetterStats {
  total: number;
  pending: number;
  processed: number;
  failed: number;
  byJobType: Record<string, number>;
}

@Injectable()
export class DeadLetterService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly events: DomainEventBus,
  ) {}

  async enqueue(dto: EnqueueJobDto) {
    const job = await this.prisma.deadLetterJob.create({
      data: {
        jobType: dto.jobType,
        payload: dto.payload,
        error: dto.error ?? null,
        maxRetries: dto.maxRetries ?? 3,
        status: "pending",
      },
    });

    this.events.emit("dead-letter.enqueued", { jobId: job.id, jobType: dto.jobType });

    return job;
  }

  async list(query: { status?: string; page?: number; pageSize?: number; skip?: number; take?: number } = {}) {
    const { page, pageSize, skip, take } = normalizePagination(query);
    const where = query.status ? { status: query.status } : undefined;
    const [data, total] = await Promise.all([
      this.prisma.deadLetterJob.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take,
      }),
      this.prisma.deadLetterJob.count({ where }),
    ]);
    return toPaginatedEnvelope(data, total, page, pageSize);
  }

  async retry(id: string) {
    const job = await this.prisma.deadLetterJob.findUnique({ where: { id } });
    if (!job) {
      throw new Error(`DeadLetterJob ${id} not found`);
    }

    if (job.status === "processed") {
      throw new Error(`DeadLetterJob ${id} already processed`);
    }

    if (job.retryCount >= job.maxRetries) {
      return this.prisma.deadLetterJob.update({
        where: { id },
        data: { status: "failed" },
      });
    }

    const updated = await this.prisma.deadLetterJob.update({
      where: { id },
      data: {
        retryCount: job.retryCount + 1,
        status: "pending",
      },
    });

    this.events.emit("dead-letter.retried", { jobId: id, retryCount: updated.retryCount });

    return updated;
  }

  async getStats(): Promise<DeadLetterStats> {
    const [total, pending, processed, failed, byType] = await Promise.all([
      this.prisma.deadLetterJob.count(),
      this.prisma.deadLetterJob.count({ where: { status: "pending" } }),
      this.prisma.deadLetterJob.count({ where: { status: "processed" } }),
      this.prisma.deadLetterJob.count({ where: { status: "failed" } }),
      this.prisma.deadLetterJob.groupBy({
        by: ["jobType"],
        _count: { jobType: true },
      }),
    ]);

    const byJobType: Record<string, number> = {};
    for (const row of byType) {
      byJobType[row.jobType] = row._count.jobType;
    }

    return { total, pending, processed, failed, byJobType };
  }
}
