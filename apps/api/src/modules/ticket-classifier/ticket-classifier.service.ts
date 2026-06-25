/**
 * AI-211: First-pass support ticket classification and routing.
 *
 * Uses explicit, inspectable rules (keyword signals + category/priority weights)
 * to assign a suggestedCategory, suggestedPriority, and suggestedRoute with a
 * confidence score. Humans can override any result at any time.
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

export const CLASSIFIER_MODEL_VERSION = "rules-v1.0.0" as const;

export const ROUTES = [
  "tier1-auto",
  "tier1-human",
  "tier2-escalate",
  "maintainer",
  "security",
] as const;
export type Route = (typeof ROUTES)[number];

export interface ClassificationSignals {
  categoryWeight: number;
  priorityWeight: number;
  keywordHits: string[];
  bodyLengthScore: number;
  tagCount: number;
}

export interface ClassificationResult {
  suggestedCategory: string;
  suggestedPriority: string;
  suggestedRoute: Route;
  confidence: number;
  signals: ClassificationSignals;
  modelVersion: string;
}

export class ClassifyTicketDto {
  @IsString()
  ticketId!: string;
}

export class OverrideClassificationDto {
  @IsString()
  suggestedCategory!: string;

  @IsString()
  suggestedPriority!: string;

  @IsString()
  suggestedRoute!: string;

  @IsOptional()
  @IsString()
  overrideNote?: string;
}

const KEYWORD_ROUTE_MAP: Record<string, Route> = {
  exploit: "security",
  abuse: "security",
  spam: "security",
  compromised: "security",
  appeal: "maintainer",
  dispute: "maintainer",
  "false positive": "maintainer",
  urgent: "tier2-escalate",
  critical: "tier2-escalate",
  blocked: "tier2-escalate",
  payout: "tier1-human",
  verification: "tier1-human",
};

const CATEGORY_WEIGHT: Record<string, number> = {
  abuse: 0.9,
  appeal: 0.8,
  verification: 0.6,
  payout: 0.6,
  bug: 0.4,
};

const PRIORITY_WEIGHT: Record<string, number> = {
  urgent: 0.9,
  high: 0.7,
  normal: 0.4,
  low: 0.2,
};

function classifyText(
  subject: string,
  body: string,
  category: string,
  priority: string,
  tags: string[],
): ClassificationResult {
  const text = `${subject} ${body}`.toLowerCase();

  const keywordHits: string[] = [];
  let routeFromKeyword: Route | null = null;

  for (const [kw, route] of Object.entries(KEYWORD_ROUTE_MAP)) {
    if (text.includes(kw)) {
      keywordHits.push(kw);
      if (!routeFromKeyword) routeFromKeyword = route;
    }
  }

  const categoryWeight = CATEGORY_WEIGHT[category] ?? 0.3;
  const priorityWeight = PRIORITY_WEIGHT[priority] ?? 0.3;
  const bodyLengthScore = Math.min(body.length / 500, 1.0);
  const tagCount = tags.length;

  const signals: ClassificationSignals = {
    categoryWeight,
    priorityWeight,
    keywordHits,
    bodyLengthScore,
    tagCount,
  };

  const confidence = Math.min(
    (categoryWeight * 0.35 +
      priorityWeight * 0.35 +
      (keywordHits.length > 0 ? 0.2 : 0) +
      bodyLengthScore * 0.1),
    1.0,
  );

  let suggestedRoute: Route;
  if (routeFromKeyword) {
    suggestedRoute = routeFromKeyword;
  } else if (confidence >= 0.75) {
    suggestedRoute = "tier1-auto";
  } else if (confidence >= 0.5) {
    suggestedRoute = "tier1-human";
  } else {
    suggestedRoute = "tier2-escalate";
  }

  return {
    suggestedCategory: category,
    suggestedPriority: priority,
    suggestedRoute,
    confidence: Math.round(confidence * 1000) / 1000,
    signals,
    modelVersion: CLASSIFIER_MODEL_VERSION,
  };
}

@Injectable()
export class TicketClassifierService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  @MapDbErrors()
  async classify(dto: ClassifyTicketDto, actorKey: string) {
    const ticket = await this.prisma.supportTicket.findUnique({
      where: { id: dto.ticketId },
    });
    if (!ticket) throw new NotFoundException("Support ticket not found");

    const tags: string[] = JSON.parse(ticket.tags ?? "[]");

    const result = classifyText(
      ticket.subject,
      ticket.body,
      ticket.category,
      ticket.priority,
      tags,
    );

    const classification = await this.prisma.ticketClassification.upsert({
      where: { ticketId: dto.ticketId },
      create: {
        ticketId: dto.ticketId,
        suggestedCategory: result.suggestedCategory,
        suggestedPriority: result.suggestedPriority,
        suggestedRoute: result.suggestedRoute,
        confidence: result.confidence,
        signals: result.signals as unknown as Prisma.InputJsonValue,
        modelVersion: result.modelVersion,
      },
      update: {
        suggestedCategory: result.suggestedCategory,
        suggestedPriority: result.suggestedPriority,
        suggestedRoute: result.suggestedRoute,
        confidence: result.confidence,
        signals: result.signals as unknown as Prisma.InputJsonValue,
        modelVersion: result.modelVersion,
        humanOverride: false,
        overriddenBy: null,
        overrideNote: null,
        overriddenAt: null,
      },
    });

    void this.audit.log({
      actor: actorKey,
      action: "ticket.classified",
      resourceType: "ticket_classification",
      resourceId: classification.id,
      summary: `Ticket ${dto.ticketId} classified as route=${result.suggestedRoute} confidence=${result.confidence}`,
      metadata: { modelVersion: result.modelVersion, signals: result.signals } as unknown as Prisma.InputJsonValue,
    });

    return classification;
  }

  @MapDbErrors()
  async getByTicket(ticketId: string) {
    const record = await this.prisma.ticketClassification.findUnique({
      where: { ticketId },
    });
    if (!record) throw new NotFoundException("No classification found for this ticket");
    return record;
  }

  @MapDbErrors()
  async override(ticketId: string, actorKey: string, dto: OverrideClassificationDto) {
    const existing = await this.prisma.ticketClassification.findUnique({
      where: { ticketId },
    });
    if (!existing) throw new NotFoundException("No classification found -- run classify first");

    if (!ROUTES.includes(dto.suggestedRoute as Route)) {
      throw new BadRequestException(`Invalid route. Must be one of: ${ROUTES.join(", ")}`);
    }

    const updated = await this.prisma.ticketClassification.update({
      where: { ticketId },
      data: {
        suggestedCategory: dto.suggestedCategory,
        suggestedPriority: dto.suggestedPriority,
        suggestedRoute: dto.suggestedRoute,
        humanOverride: true,
        overriddenBy: actorKey,
        overrideNote: dto.overrideNote ?? null,
        overriddenAt: new Date(),
      },
    });

    void this.audit.log({
      actor: actorKey,
      action: "ticket.classification.overridden",
      resourceType: "ticket_classification",
      resourceId: existing.id,
      summary: `Human override on ticket ${ticketId}: route=${dto.suggestedRoute}`,
      metadata: { overrideNote: dto.overrideNote } as Prisma.InputJsonValue,
    });

    return updated;
  }

  @MapDbErrors()
  async listByRoute(route: string) {
    if (!ROUTES.includes(route as Route)) {
      throw new BadRequestException(`Invalid route. Must be one of: ${ROUTES.join(", ")}`);
    }
    return this.prisma.ticketClassification.findMany({
      where: { suggestedRoute: route },
      orderBy: { createdAt: "desc" },
    });
  }
}
