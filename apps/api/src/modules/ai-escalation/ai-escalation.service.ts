/**
 * AI-931: Escalate low-confidence AI output to humans.
 */

import { Injectable, NotFoundException } from "@nestjs/common";
import { IsString, IsNumber, IsOptional, Min, Max } from "class-validator";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../lib/prisma.service.js";
import { AuditService } from "../../lib/audit.service.js";
import { MapDbErrors } from "../../lib/db-error.mapper.js";

export const AI_ESCALATION_MODEL_VERSION = "rules-v1.0.0" as const;

export type EscalationDecision = "auto_accept" | "escalate" | "auto_reject";

export interface EscalationResult {
  decision: EscalationDecision;
  reason: string;
  requiresHumanReview: boolean;
}

export class EvaluateEscalationDto {
  @IsString()
  outputId!: string;

  @IsString()
  outputType!: string;

  @IsNumber()
  @Min(0)
  @Max(1)
  confidence!: number;

  @IsOptional()
  @IsString()
  context?: string;
}

export class ResolveEscalationDto {
  @IsString()
  resolution!: string;

  @IsOptional()
  @IsString()
  note?: string;
}

const CONFIDENCE_THRESHOLDS = {
  autoAccept: 0.85,
  autoReject: 0.2,
} as const;

function evaluate(confidence: number, outputType: string): EscalationResult {
  if (confidence >= CONFIDENCE_THRESHOLDS.autoAccept) {
    return { decision: "auto_accept", reason: `Confidence ${confidence} meets auto-accept threshold`, requiresHumanReview: false };
  }
  if (confidence <= CONFIDENCE_THRESHOLDS.autoReject) {
    return { decision: "auto_reject", reason: `Confidence ${confidence} is below auto-reject threshold`, requiresHumanReview: true };
  }
  return {
    decision: "escalate",
    reason: `Confidence ${confidence} is in the uncertain range for output type "${outputType}" -- human review required`,
    requiresHumanReview: true,
  };
}

@Injectable()
export class AiEscalationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  @MapDbErrors()
  async evaluate(dto: EvaluateEscalationDto, actorKey: string) {
    const result = evaluate(dto.confidence, dto.outputType);

    const record = await this.prisma.aiEscalation.upsert({
      where: { outputId: dto.outputId },
      create: {
        outputId: dto.outputId,
        outputType: dto.outputType,
        confidence: dto.confidence,
        decision: result.decision,
        reason: result.reason,
        requiresHumanReview: result.requiresHumanReview,
        modelVersion: AI_ESCALATION_MODEL_VERSION,
      },
      update: {
        confidence: dto.confidence,
        decision: result.decision,
        reason: result.reason,
        requiresHumanReview: result.requiresHumanReview,
        modelVersion: AI_ESCALATION_MODEL_VERSION,
        resolvedBy: null,
        resolution: null,
        resolvedAt: null,
      },
    });

    void this.audit.log({
      actor: actorKey,
      action: "ai.escalation.evaluated",
      resourceType: "ai_escalation",
      resourceId: record.id,
      summary: `Output ${dto.outputId} (${dto.outputType}): decision=${result.decision}, confidence=${dto.confidence}`,
      metadata: { modelVersion: AI_ESCALATION_MODEL_VERSION, decision: result.decision } as Prisma.InputJsonValue,
    });

    return record;
  }

  @MapDbErrors()
  async resolve(outputId: string, actorKey: string, dto: ResolveEscalationDto) {
    const existing = await this.prisma.aiEscalation.findUnique({ where: { outputId } });
    if (!existing) throw new NotFoundException("No escalation record found for this output");

    const updated = await this.prisma.aiEscalation.update({
      where: { outputId },
      data: {
        resolution: dto.resolution,
        resolvedBy: actorKey,
        resolvedAt: new Date(),
        requiresHumanReview: false,
      },
    });

    void this.audit.log({
      actor: actorKey,
      action: "ai.escalation.resolved",
      resourceType: "ai_escalation",
      resourceId: existing.id,
      summary: `Escalation for ${outputId} resolved by human`,
      metadata: { resolution: dto.resolution, note: dto.note } as Prisma.InputJsonValue,
    });

    return updated;
  }

  @MapDbErrors()
  async getPending() {
    return this.prisma.aiEscalation.findMany({
      where: { requiresHumanReview: true, resolvedAt: null },
      orderBy: { createdAt: "asc" },
    });
  }

  @MapDbErrors()
  async getByOutput(outputId: string) {
    const record = await this.prisma.aiEscalation.findUnique({ where: { outputId } });
    if (!record) throw new NotFoundException("No escalation record found for this output");
    return record;
  }
}
