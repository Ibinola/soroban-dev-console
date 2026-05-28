import { Injectable, NotFoundException } from "@nestjs/common";
import { MapDbErrors } from "../../lib/db-error.mapper.js";
import { AuditService } from "../../lib/audit.service.js";
import { ContributorVerificationRepository } from "./contributor-verification.repository.js";

export type VerificationStatus = "pending" | "verified" | "restricted" | "rejected";

export interface UpsertVerificationDto {
  contributorId: string;
  status: VerificationStatus;
  manualReviewNote?: string;
  priorCompletionCount?: number;
  restrictionReason?: string;
}

@Injectable()
export class ContributorVerificationService {
  constructor(
    private readonly repository: ContributorVerificationRepository,
    private readonly audit: AuditService,
  ) {}

  @MapDbErrors()
  async upsert(dto: UpsertVerificationDto) {
    const record = await this.repository.upsert({
      where: { contributorId: dto.contributorId },
      create: {
        contributorId: dto.contributorId,
        status: dto.status,
        manualReviewNote: dto.manualReviewNote ?? null,
        priorCompletionCount: dto.priorCompletionCount ?? 0,
        restrictionReason: dto.restrictionReason ?? null,
      },
      update: {
        status: dto.status,
        manualReviewNote: dto.manualReviewNote ?? null,
        restrictionReason: dto.restrictionReason ?? null,
        ...(dto.priorCompletionCount !== undefined
          ? { priorCompletionCount: dto.priorCompletionCount }
          : {}),
        updatedAt: new Date(),
      },
    });
    void this.audit.log({
      actor: dto.contributorId,
      action: "contributor.verification.upserted",
      resourceType: "contributor_verification",
      resourceId: record.id,
      summary: `Verification status set to "${dto.status}"`,
    });
    return record;
  }

  @MapDbErrors()
  async get(contributorId: string) {
    const record = await this.repository.findFirst({ where: { contributorId } });
    if (!record) throw new NotFoundException("Contributor verification record not found");
    return record;
  }

  @MapDbErrors()
  async list() {
    return this.repository.findMany({ orderBy: { updatedAt: "desc" } });
  }

  @MapDbErrors()
  async isEligible(contributorId: string): Promise<{ eligible: boolean; reason?: string }> {
    const record = await this.repository.findFirst({ where: { contributorId } });
    if (!record) return { eligible: false, reason: "No verification record found" };
    if (record.status === "verified") return { eligible: true };
    return { eligible: false, reason: record.restrictionReason ?? record.status };
  }
}
