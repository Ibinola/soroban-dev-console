import { Injectable, Logger, ConflictException } from "@nestjs/common";
import { PrismaService } from "../../lib/prisma.service.js";
import { AuditService } from "../../lib/audit.service.js";
import { assertNoDuplicateActiveReservation } from "./budget-accounting.js";
import { Prisma } from "@prisma/client";
import {
  OrganizationBudgetSummary,
  PointReservationSummary,
  BudgetEventSummary,
  BudgetMetrics,
  GetBudgetMetricsQuery,
  SetOrganizationBudgetPayload,
  ReservePointsPayload,
  ReleaseReservationPayload,
  ReconcileBudgetPayload,
  ReservationType,
  ReservationStatus,
  BudgetEventType,
} from "@devconsole/api-contracts";

@Injectable()
export class BudgetService {
  constructor(
    private readonly prisma: PrismaService,
  ) {}

  async setOrganizationBudget(payload: SetOrganizationBudgetPayload): Promise<OrganizationBudgetSummary> {
    // Implementation will be added after Prisma client generation
    return {} as any;
  }

  async reservePoints(payload: ReservePointsPayload): Promise<PointReservationSummary> {
    try {
      const existing = await this.prisma.pointReservation.findMany({
        where: { issueRef: payload.issueRef, contributorId: payload.contributorId }
      });

      const check = assertNoDuplicateActiveReservation(existing as any, payload.issueRef);
      if (!check.ok) {
        throw new ConflictException(check.reason);
      }

      const reservation = await this.prisma.pointReservation.create({
        data: {
          organizationId: payload.organizationId,
          contributorId: payload.contributorId,
          issueRef: payload.issueRef,
          reservationType: payload.reservationType,
          points: payload.points,
          status: "pending",
        }
      });

      return {
        id: reservation.id,
        organizationId: reservation.organizationId,
        contributorId: reservation.contributorId,
        issueRef: reservation.issueRef,
        reservationType: reservation.reservationType as ReservationType,
        points: reservation.points,
        status: reservation.status as ReservationStatus,
        createdAt: reservation.createdAt.toISOString(),
      };
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException("A concurrent reservation already exists for this contributor and issue.");
      }
      throw error;
    }
  }

  async releaseReservation(payload: ReleaseReservationPayload): Promise<PointReservationSummary> {
    // Implementation will be added after Prisma client generation
    return {} as any;
  }

  async getBudgetMetrics(query: GetBudgetMetricsQuery): Promise<BudgetMetrics> {
    // Implementation will be added after Prisma client generation
    return {} as any;
  }

  async reconcileBudget(payload: ReconcileBudgetPayload): Promise<{ reconciledCount: number; dryRun: boolean }> {
    // Implementation will be added after Prisma client generation
    return { reconciledCount: 0, dryRun: true };
  }
}
