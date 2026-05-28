import { Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { MapDbErrors } from "../../lib/db-error.mapper.js";
import { AuditService } from "../../lib/audit.service.js";
import { AppealDecisionsRepository } from "./appeal-decisions.repository.js";

export type AppealOutcome = "approved" | "rejected" | "escalated";

export interface RecordAppealDecisionDto {
  appealId: string;
  contributorId: string;
  outcome: AppealOutcome;
  modelVersion?: string;
  humanOverride?: boolean;
  rationaleSummary?: string;
  reviewedBy?: string;
}

@Injectable()
export class AppealDecisionsService {
  constructor(
    private readonly repository: AppealDecisionsRepository,
    private readonly audit: AuditService,
  ) {}

  @MapDbErrors()
  async record(dto: RecordAppealDecisionDto) {
    const decision = await this.repository.create({
      data: {
        appealId: dto.appealId,
        contributorId: dto.contributorId,
        outcome: dto.outcome,
        modelVersion: dto.modelVersion ?? null,
        humanOverride: dto.humanOverride ?? false,
        rationaleSummary: dto.rationaleSummary ?? null,
        reviewedBy: dto.reviewedBy ?? null,
      },
    });
    void this.audit.log({
      actor: dto.reviewedBy ?? dto.contributorId,
      action: "appeal.decision.recorded",
      resourceType: "appeal_decision",
      resourceId: decision.id,
      summary: `Appeal ${dto.appealId} outcome: ${dto.outcome}`,
      metadata: { humanOverride: dto.humanOverride, modelVersion: dto.modelVersion } as Prisma.InputJsonValue,
    });
    return decision;
  }

  @MapDbErrors()
  async listByAppeal(appealId: string) {
    return this.repository.findMany({
      where: { appealId },
      orderBy: { decidedAt: "desc" },
    });
  }

  @MapDbErrors()
  async listByContributor(contributorId: string) {
    return this.repository.findMany({
      where: { contributorId },
      orderBy: { decidedAt: "desc" },
    });
  }

  @MapDbErrors()
  async get(id: string) {
    const record = await this.repository.findFirst({ where: { id } });
    if (!record) throw new NotFoundException("Appeal decision not found");
    return record;
  }
}
