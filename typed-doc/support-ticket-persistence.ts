/**
 * Issue #494 (BE-325): Persist support ticket records explicitly
 *
 * Problem: SupportTicket model exists but the service layer has no
 * explicit state machine, no required field validation, and no
 * enforcement of transition rules. Status changes are freeform.
 *
 * Solution: Implement an explicit state machine for ticket lifecycle,
 * add required field validation at creation, enforce transition rules,
 * and log all state changes as audit events.
 */

// ---- FIXED: support-tickets.service.ts — state machine ----

export const TICKET_STATES = {
  OPEN: "open",
  IN_PROGRESS: "in_progress",
  RESOLVED: "resolved",
  CLOSED: "closed",
} as const;

// Allowed transitions
const STATE_TRANSITIONS: Record<string, string[]> = {
  [TICKET_STATES.OPEN]: [TICKET_STATES.IN_PROGRESS, TICKET_STATES.CLOSED],
  [TICKET_STATES.IN_PROGRESS]: [TICKET_STATES.RESOLVED, TICKET_STATES.OPEN, TICKET_STATES.CLOSED],
  [TICKET_STATES.RESOLVED]: [TICKET_STATES.CLOSED, TICKET_STATES.IN_PROGRESS],
  [TICKET_STATES.CLOSED]: [TICKET_STATES.OPEN], // reopen
};

@Injectable()
export class SupportTicketsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async create(dto: CreateSupportTicketDto, reporterKey: string): Promise<SupportTicket> {
    // Validate required fields explicitly
    if (!dto.subject || dto.subject.trim().length === 0) {
      throw new BadRequestException("subject is required");
    }
    if (!dto.body || dto.body.trim().length === 0) {
      throw new BadRequestException("body is required");
    }
    if (!TICKET_CATEGORIES.includes(dto.category)) {
      throw new BadRequestException(`category must be one of: ${TICKET_CATEGORIES.join(", ")}`);
    }

    const record = await this.prisma.supportTicket.create({
      data: {
        subject: dto.subject.trim(),
        body: dto.body.trim(),
        category: dto.category,
        status: TICKET_STATES.OPEN,
        priority: dto.priority ?? "normal",
        reporterKey,
        tags: JSON.stringify(dto.tags ?? []),
      },
    });

    await this.audit.log({
      actor: reporterKey,
      action: "support_ticket.created",
      resourceType: "support_ticket",
      resourceId: record.id,
      summary: `Ticket created: ${dto.category} — ${dto.subject}`,
      metadata: { category: dto.category, priority: record.priority },
    });

    return record;
  }

  async transition(id: string, newStatus: string, actor: string): Promise<SupportTicket> {
    const ticket = await this.prisma.supportTicket.findUnique({ where: { id } });
    if (!ticket) throw new NotFoundException("Ticket not found");

    const allowed = STATE_TRANSITIONS[ticket.status];
    if (!allowed || !allowed.includes(newStatus)) {
      throw new BadRequestException(
        `Cannot transition from '${ticket.status}' to '${newStatus}'. ` +
        `Allowed: ${allowed?.join(", ") || "none"}`
      );
    }

    const updated = await this.prisma.supportTicket.update({
      where: { id },
      data: {
        status: newStatus,
        resolvedAt: newStatus === TICKET_STATES.RESOLVED ? new Date() : undefined,
      },
    });

    await this.audit.log({
      actor,
      action: "support_ticket.transitioned",
      resourceType: "support_ticket",
      resourceId: id,
      summary: `Ticket ${id}: ${ticket.status} → ${newStatus}`,
      metadata: { from: ticket.status, to: newStatus, previousAssignee: ticket.assigneeKey },
    });

    return updated;
  }

  async update(id: string, dto: UpdateSupportTicketDto, actor: string): Promise<SupportTicket> {
    const ticket = await this.prisma.supportTicket.findUnique({ where: { id } });
    if (!ticket) throw new NotFoundException("Ticket not found");

    // If this is a status change, enforce state machine
    if (dto.status && dto.status !== ticket.status) {
      return this.transition(id, dto.status, actor);
    }

    const updated = await this.prisma.supportTicket.update({
      where: { id },
      data: {
        ...(dto.priority ? { priority: dto.priority } : {}),
        ...(dto.assigneeKey ? { assigneeKey: dto.assigneeKey } : {}),
        ...(dto.tags ? { tags: JSON.stringify(dto.tags) } : {}),
      },
    });

    return updated;
  }

  /** Explicit close — terminal state requires reason. */
  async close(id: string, reason: string, actor: string): Promise<SupportTicket> {
    if (!reason || reason.trim().length === 0) {
      throw new BadRequestException("A reason is required to close a ticket");
    }
    return this.transition(id, TICKET_STATES.CLOSED, actor);
  }
}
