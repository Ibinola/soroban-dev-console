/**
 * BE-206: Ingest and reconcile contributor verification events reliably.
 *
 * Idempotent: duplicate eventIds are silently ignored.
 * Retries are handled at the job layer (BE-216).
 */

import { ConflictException, Injectable, Logger } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../lib/prisma.service.js";
import { AuditService } from "../../lib/audit.service.js";
import { DomainEventBus } from "../../lib/domain-event-bus.js";
import type { VerificationEventPayload, VerificationEventResult } from "@devconsole/api-contracts";

export const VERIFICATION_INGESTED = "verification.ingested" as const;

export interface VerificationIngestedEvent {
  id: string;
  contributorId: string;
  provider: string;
  status: string;
}

@Injectable()
export class VerificationService {
  private readonly logger = new Logger(VerificationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly events: DomainEventBus,
  ) {}

  /**
   * Ingest a single verification event. Idempotent on eventId.
   */
  async ingest(payload: VerificationEventPayload): Promise<VerificationEventResult> {
    const existing = await this.prisma.verificationEvent.findUnique({
      where: { eventId: payload.eventId },
    });

    if (existing) {
      this.logger.debug(`Duplicate verification event ignored: ${payload.eventId}`);
      return this.toResult(existing);
    }

    let record: Awaited<ReturnType<typeof this.prisma.verificationEvent.create>>;
    try {
      record = await this.prisma.verificationEvent.create({
        data: {
          eventId: payload.eventId,
          contributorId: payload.contributorId,
          provider: payload.provider,
          status: payload.status,
          verifiedAt: payload.verifiedAt ? new Date(payload.verifiedAt) : null,
          metadata: (payload.metadata ?? Prisma.JsonNull) as Prisma.InputJsonValue,
        },
      });
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === "P2002"
      ) {
        // Race condition — another request already inserted this eventId
        const dup = await this.prisma.verificationEvent.findUnique({
          where: { eventId: payload.eventId },
        });
        return this.toResult(dup!);
      }
      throw err;
    }

    this.events.emit<VerificationIngestedEvent>(VERIFICATION_INGESTED, {
      id: record.id,
      contributorId: record.contributorId,
      provider: record.provider,
      status: record.status,
    });

    void this.audit.log({
      actor: `provider:${payload.provider}`,
      action: "verification.ingested",
      resourceType: "verification_event",
      resourceId: record.id,
      summary: `Contributor ${payload.contributorId} verification: ${payload.status}`,
    });

    return this.toResult(record);
  }

  async findByContributor(contributorId: string): Promise<VerificationEventResult[]> {
    const records = await this.prisma.verificationEvent.findMany({
      where: { contributorId },
      orderBy: { processedAt: "desc" },
    });
    return records.map((r) => this.toResult(r));
  }

  private toResult(r: {
    id: string;
    contributorId: string;
    provider: string;
    status: string;
    eventId: string;
    processedAt: Date;
  }): VerificationEventResult {
    return {
      id: r.id,
      contributorId: r.contributorId,
      provider: r.provider,
      status: r.status as VerificationEventResult["status"],
      eventId: r.eventId,
      processedAt: r.processedAt.toISOString(),
    };
  }
}
