import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from "@nestjs/common";
import { IsString, IsOptional, IsIn, IsInt, Min } from "class-validator";
import { Type } from "class-transformer";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../lib/prisma.service.js";
import { MapDbErrors } from "../../lib/db-error.mapper.js";
import { AuditService } from "../../lib/audit.service.js";

export const TICKET_CATEGORIES = ["verification", "payout", "appeal", "bug", "abuse"] as const;
export const TICKET_STATUSES = ["open", "in_progress", "resolved", "closed"] as const;
export const TICKET_PRIORITIES = ["low", "normal", "high", "urgent"] as const;

export type TicketCategory = (typeof TICKET_CATEGORIES)[number];
export type TicketStatus = (typeof TICKET_STATUSES)[number];
export type TicketPriority = (typeof TICKET_PRIORITIES)[number];

export class CreateSupportTicketDto {
  @IsString()
  subject!: string;

  @IsString()
  body!: string;

  @IsIn(TICKET_CATEGORIES)
  category!: TicketCategory;

  @IsOptional()
  @IsIn(TICKET_PRIORITIES)
  priority?: TicketPriority;

  @IsOptional()
  tags?: string[];
}

export class UpdateSupportTicketDto {
  @IsOptional()
  @IsIn(TICKET_STATUSES)
  status?: TicketStatus;

  @IsOptional()
  @IsIn(TICKET_PRIORITIES)
  priority?: TicketPriority;

  @IsOptional()
  @IsString()
  assigneeKey?: string;

  @IsOptional()
  tags?: string[];
}

export class ListSupportTicketsDto {
  @IsOptional()
  @IsIn(TICKET_CATEGORIES)
  category?: TicketCategory;

  @IsOptional()
  @IsIn(TICKET_STATUSES)
  status?: TicketStatus;

  @IsOptional()
  @IsIn(TICKET_PRIORITIES)
  priority?: TicketPriority;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  skip?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  take?: number;
}

@Injectable()
export class SupportTicketsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  @MapDbErrors()
  async create(reporterKey: string, dto: CreateSupportTicketDto) {
    if (!TICKET_CATEGORIES.includes(dto.category as TicketCategory)) {
      throw new BadRequestException(`Invalid category. Must be one of: ${TICKET_CATEGORIES.join(", ")}`);
    }

    const ticket = await this.prisma.supportTicket.create({
      data: {
        subject: dto.subject.trim(),
        body: dto.body.trim(),
        category: dto.category,
        priority: dto.priority ?? "normal",
        reporterKey,
        tags: JSON.stringify(dto.tags ?? []),
      },
    });

    void this.audit.log({
      actor: reporterKey,
      action: "support_ticket.created",
      resourceType: "support_ticket",
      resourceId: ticket.id,
      summary: `Created support ticket "${ticket.subject}" [${ticket.category}]`,
    });

    return { ...ticket, tags: JSON.parse(ticket.tags) };
  }

  @MapDbErrors()
  async list(query: ListSupportTicketsDto = {}) {
    const skip = query.skip ?? 0;
    const take = query.take ?? 20;

    const where = {
      ...(query.category ? { category: query.category } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.priority ? { priority: query.priority } : {}),
    };

    const [rows, total] = await Promise.all([
      this.prisma.supportTicket.findMany({
        where,
        orderBy: [{ priority: "desc" }, { createdAt: "desc" }],
        skip,
        take,
      }),
      this.prisma.supportTicket.count({ where }),
    ]);

    return {
      data: rows.map((t) => ({ ...t, tags: JSON.parse(t.tags) })),
      pagination: { total, skip, take },
    };
  }

  @MapDbErrors()
  async get(id: string) {
    const ticket = await this.prisma.supportTicket.findUnique({ where: { id } });
    if (!ticket) throw new NotFoundException("Support ticket not found");
    return { ...ticket, tags: JSON.parse(ticket.tags) };
  }

  @MapDbErrors()
  async update(id: string, actorKey: string, dto: UpdateSupportTicketDto) {
    const ticket = await this.get(id);

    const admins = process.env.SUPPORT_ADMIN_KEYS ? process.env.SUPPORT_ADMIN_KEYS.split(',') : [];
    const isAdmin = admins.includes(actorKey);

    if (actorKey !== ticket.reporterKey && !isAdmin) {
      throw new ForbiddenException("Not authorized to update this support ticket");
    }

    if (dto.assigneeKey !== undefined && !isAdmin) {
      throw new ForbiddenException("Only support administrators can assign tickets");
    }

    if (dto.status !== undefined && dto.status !== "closed" && !isAdmin) {
      throw new ForbiddenException("Only support administrators can transition ticket status");
    }

    const updatedTicket = await this.prisma.supportTicket.update({
      where: { id },
      data: {
        ...(dto.status !== undefined ? { status: dto.status } : {}),
        ...(dto.priority !== undefined ? { priority: dto.priority } : {}),
        ...(dto.assigneeKey !== undefined ? { assigneeKey: dto.assigneeKey } : {}),
        ...(dto.tags !== undefined ? { tags: JSON.stringify(dto.tags) } : {}),
        ...(dto.status === "resolved" ? { resolvedAt: new Date() } : {}),
      },
    });

    void this.audit.log({
      actor: actorKey,
      action: "support_ticket.updated",
      resourceType: "support_ticket",
      resourceId: id,
      summary: `Updated support ticket`,
      metadata: { changes: dto as Record<string, unknown> } as Prisma.InputJsonValue,
    });

    return { ...updatedTicket, tags: JSON.parse(updatedTicket.tags) };
  }
}
