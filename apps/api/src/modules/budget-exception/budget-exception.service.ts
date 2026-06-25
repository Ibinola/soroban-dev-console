/**
 * AI-213: Recommend org-budget exception reviews using structured signals.
 *
 * Derives utilization, pacing, and fairness signals from existing budget and
 * reservation records. Final decisions always stay with humans.
 */

import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from "@nestjs/common";
import { IsString, IsOptional } from "class-validator";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../lib/prisma.service.js";
import { AuditService } from "../../lib/audit.service.js";
import { MapDbErrors } from "../../lib/db-error.mapper.js";

export const EXCEPTION_MODEL_VERSION = "rules-v1.0.0" as const;

export const RECOMMENDATIONS = ["review", "no-review", "escalate"] as const;
export type Recommendation = (typeof RECOMMENDATIONS)[number];

export interface ExceptionSignals {
  totalBudget: number;
  usedPoints: number;
  pendingPoints: number;
  utilizationRatio: number;
  pendingReservationCount: number;
  uniqueContributors: number;
  highConcentration: boolean;
}

export class RecommendExceptionDto {
  @IsString()
  organizationId!: string;
}

export class DecideExceptionDto {
  @IsString()
  humanDecision!: string;
  @IsOptional()
  @IsString()
  decisionNote?: string;
}

const UTILIZATION_REVIEW_THRESHOLD = 0.80;
const UTILIZATION_ESCALATE_THRESHOLD = 0.95;
const CONCENTRATION_RATIO = 0.5;

async function buildSignals(
  prisma: PrismaService,
  organizationId: string,
): Promise<ExceptionSignals> {
  const budget = await prisma.organizationBudget.findFirst({
    where: { organizationId },
  });

  const totalBudget = budget?.capPoints ?? 0;

  const reservations = await prisma.pointReservation.findMany({
    where: { organizationId },
    select: { points: true, status: true, contributorId: true },
  });

  const usedPoints = reservations
    .filter((r) => r.status === "released" || r.status === "settled")
    .reduce((sum, r) => sum + r.points, 0);

  const pending = reservations.filter((r) => r.status === "pending");
  const pendingPoints = pending.reduce((sum, r) => sum + r.points, 0);
  const pendingReservationCount = pending.length;

  const allContributors = new Set(reservations.map((r) => r.contributorId));
  const uniqueContributors = allContributors.size;

  const topContributorPoints = uniqueContributors > 0
    ? Math.max(
        ...Array.from(allContributors).map((id) =>
          reservations
            .filter((r) => r.contributorId === id)
            .reduce((sum, r) => sum + r.points, 0),
        ),
      )
    : 0;

  const utilizationRatio =
    totalBudget > 0 ? (usedPoints + pendingPoints) / totalBudget : 0;

  const highConcentration =
    uniqueContributors > 0 &&
    topContributorPoints / (usedPoints + pendingPoints || 1) >= CONCENTRATION_RATIO;

  return {
    totalBudget,
    usedPoints,
    pendingPoints,
    utilizationRatio: Math.round(utilizationRatio * 1000) / 1000,
    pendingReservationCount,
    uniqueContributors,
    highConcentration,
  };
}

function deriveRecommendation(signals: ExceptionSignals): {
  recommendation: Recommendation;
  confidence: number;
} {
  if (signals.utilizationRatio >= UTILIZATION_ESCALATE_THRESHOLD) {
    return { recommendation: "escalate", confidence: 0.9 };
  }
  if (
    signals.utilizationRatio >= UTILIZATION_REVIEW_THRESHOLD ||
    signals.highConcentration
  ) {
    return { recommendation: "review", confidence: 0.75 };
  }
  return { recommendation: "no-review", confidence: 0.8 };
}

@Injectable()
export class BudgetExceptionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  @MapDbErrors()
  async recommend(dto: RecommendExceptionDto, actorKey: string) {
    const signals = await buildSignals(this.prisma, dto.organizationId);
    const { recommendation, confidence } = deriveRecommendation(signals);

    const record = await this.prisma.budgetExceptionRecommendation.upsert({
      where: { organizationId: dto.organizationId },
      create: {
        organizationId: dto.organizationId,
        signals: signals as unknown as Prisma.InputJsonValue,
        recommendation,
        confidence,
        modelVersion: EXCEPTION_MODEL_VERSION,
      },
      update: {
        signals: signals as unknown as Prisma.InputJsonValue,
        recommendation,
        confidence,
        modelVersion: EXCEPTION_MODEL_VERSION,
        humanDecision: null,
        decidedBy: null,
        decisionNote: null,
        decidedAt: null,
      },
    });

    void this.audit.log({
      actor: actorKey,
      action: "budget.exception.recommended",
      resourceType: "budget_exception_recommendation",
      resourceId: record.id,
      summary: `Org ${dto.organizationId} exception recommendation: ${recommendation} (confidence=${confidence})`,
      metadata: { modelVersion: EXCEPTION_MODEL_VERSION, signals } as unknown as Prisma.InputJsonValue,
    });

    return record;
  }

  @MapDbErrors()
  async getByOrg(organizationId: string) {
    const record = await this.prisma.budgetExceptionRecommendation.findUnique({
      where: { organizationId },
    });
    if (!record) throw new NotFoundException("No recommendation found -- run recommend first");
    return record;
  }

  @MapDbErrors()
  async decide(organizationId: string, actorKey: string, dto: DecideExceptionDto) {
    const existing = await this.prisma.budgetExceptionRecommendation.findUnique({
      where: { organizationId },
    });
    if (!existing) throw new NotFoundException("No recommendation found -- run recommend first");

    const updated = await this.prisma.budgetExceptionRecommendation.update({
      where: { organizationId },
      data: {
        humanDecision: dto.humanDecision,
        decidedBy: actorKey,
        decisionNote: dto.decisionNote ?? null,
        decidedAt: new Date(),
      },
    });

    void this.audit.log({
      actor: actorKey,
      action: "budget.exception.decided",
      resourceType: "budget_exception_recommendation",
      resourceId: existing.id,
      summary: `Human decision on org ${organizationId}: ${dto.humanDecision}`,
      metadata: { decisionNote: dto.decisionNote } as Prisma.InputJsonValue,
    });

    return updated;
  }

  @MapDbErrors()
  async listPending() {
    return this.prisma.budgetExceptionRecommendation.findMany({
      where: { humanDecision: null },
      orderBy: { createdAt: "desc" },
    });
  }
}
