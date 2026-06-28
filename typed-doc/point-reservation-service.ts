/**
 * Issue #502 (BE-333): Add a point reservation service for budgets
 *
 * Problem: BudgetService has stub implementations for setOrganizationBudget,
 * releaseReservation, getBudgetMetrics. PointReservation exists as a model
 * but the service layer lacks a proper reservation lifecycle: hold → confirm
 * → release (or expire).
 *
 * Solution: Full reservation service with hold/confirm/release/expire
 * lifecycle, budget cap enforcement, and audit logging.
 */

// ---- FIXED: budget.service.ts — reservation lifecycle ----

export const RESERVATION_STATUS = {
  PENDING: "pending",
  ACTIVE: "active",
  RELEASED: "released",
  CANCELLED: "cancelled",
  EXPIRED: "expired",
} as const;

const RESERVATION_TIMEOUT_MS = 86_400_000; // 24h before expiry

@Injectable()
export class BudgetService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  @MapDbErrors()
  async setOrganizationBudget(payload: SetOrganizationBudgetPayload): Promise<OrganizationBudgetSummary> {
    const budget = await this.prisma.organizationBudget.upsert({
      where: { organizationId: payload.organizationId },
      update: { capPoints: payload.capPoints },
      create: {
        organizationId: payload.organizationId,
        capPoints: payload.capPoints,
        usedPoints: payload.usedPoints ?? 0,
        reservedPoints: payload.reservedPoints ?? 0,
        releasedPoints: 0,
      },
    });

    await this.audit.log({
      actor: "system:budget",
      action: "budget.cap_set",
      resourceType: "organization_budget",
      resourceId: budget.id,
      summary: `Budget cap set to ${payload.capPoints} for ${payload.organizationId}`,
    });

    return this.toBudgetSummary(budget);
  }

  @MapDbErrors()
  async reservePoints(payload: ReservePointsPayload): Promise<PointReservationSummary> {
    // 1. Check budget cap has capacity
    const budget = await this.prisma.organizationBudget.findUnique({
      where: { organizationId: payload.organizationId },
    });
    if (!budget) throw new NotFoundException("Organization budget not found");

    const totalCommitted = budget.usedPoints + budget.reservedPoints;
    if (totalCommitted + payload.points > budget.capPoints) {
      throw new BadRequestException(
        `Reservation of ${payload.points} would exceed cap of ${budget.capPoints}. ` +
        `Already committed: ${totalCommitted}`
      );
    }

    // 2. Check for duplicate active reservation
    const existing = await this.prisma.pointReservation.findMany({
      where: {
        issueRef: payload.issueRef,
        contributorId: payload.contributorId,
        status: { in: [RESERVATION_STATUS.PENDING, RESERVATION_STATUS.ACTIVE] },
      },
    });
    if (existing.length > 0) {
      throw new ConflictException("An active reservation already exists for this issue");
    }

    // 3. Create reservation + increment reservedPoints atomically
    const [reservation] = await this.prisma.$transaction([
      this.prisma.pointReservation.create({
        data: {
          organizationId: payload.organizationId,
          contributorId: payload.contributorId,
          issueRef: payload.issueRef,
          reservationType: payload.reservationType,
          points: payload.points,
          status: RESERVATION_STATUS.PENDING,
        },
      }),
      this.prisma.organizationBudget.update({
        where: { organizationId: payload.organizationId },
        data: { reservedPoints: { increment: payload.points } },
      }),
    ]);

    await this.audit.log({
      actor: "system:budget",
      action: "budget.reservation_created",
      resourceType: "point_reservation",
      resourceId: reservation.id,
      summary: `Reserved ${payload.points}pts for ${payload.contributorId} on ${payload.issueRef}`,
    });

    return this.toReservationSummary(reservation);
  }

  @MapDbErrors()
  async confirmReservation(id: string) {
    const reservation = await this.prisma.pointReservation.findUnique({ where: { id } });
    if (!reservation) throw new NotFoundException("Reservation not found");

    if (reservation.status !== RESERVATION_STATUS.PENDING) {
      throw new BadRequestException(`Reservation is in state '${reservation.status}', cannot confirm`);
    }

    const [updated] = await this.prisma.$transaction([
      this.prisma.pointReservation.update({
        where: { id },
        data: { status: RESERVATION_STATUS.ACTIVE },
      }),
      this.prisma.organizationBudget.update({
        where: { organizationId: reservation.organizationId },
        data: { usedPoints: { increment: reservation.points } },
      }),
    ]);

    return this.toReservationSummary(updated);
  }

  @MapDbErrors()
  async releaseReservation(payload: ReleaseReservationPayload): Promise<PointReservationSummary> {
    const reservation = await this.prisma.pointReservation.findUnique({
      where: { id: payload.reservationId },
    });
    if (!reservation) throw new NotFoundException("Reservation not found");

    const [updated] = await this.prisma.$transaction([
      this.prisma.pointReservation.update({
        where: { id: payload.reservationId },
        data: { status: RESERVATION_STATUS.RELEASED, releasedAt: new Date() },
      }),
      this.prisma.organizationBudget.update({
        where: { organizationId: reservation.organizationId },
        data: {
          reservedPoints: { decrement: reservation.points },
          releasedPoints: { increment: reservation.points },
        },
      }),
    ]);

    return this.toReservationSummary(updated);
  }

  @MapDbErrors()
  async expireStaleReservations(): Promise<number> {
    const cutoff = new Date(Date.now() - RESERVATION_TIMEOUT_MS);
    const stale = await this.prisma.pointReservation.findMany({
      where: {
        status: RESERVATION_STATUS.PENDING,
        createdAt: { lt: cutoff },
      },
    });

    for (const s of stale) {
      await this.prisma.$transaction([
        this.prisma.pointReservation.update({
          where: { id: s.id },
          data: { status: RESERVATION_STATUS.EXPIRED, releasedAt: new Date() },
        }),
        this.prisma.organizationBudget.update({
          where: { organizationId: s.organizationId },
          data: {
            reservedPoints: { decrement: s.points },
            releasedPoints: { increment: s.points },
          },
        }),
      ]);
    }

    return stale.length;
  }
}
