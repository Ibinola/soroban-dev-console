/**
 * Issue #503 (BE-334): Capture security event logs in one stream
 *
 * Problem: Security module exists as an empty shell (no services).
 * Security-relevant events (login failures, permission changes, token
 * revocation, rate limit breaches) are scattered across different
 * modules with no consistent stream for alerting and review.
 *
 * Solution: Create a SecurityEventsService that provides a single
 * ingestion point for security events, with normalized schema,
 * severity levels, and a queryable stream.
 */

// ---- NEW: security-event.entity.ts (Prisma schema) ----
model SecurityEvent {
  id          String   @id @default(cuid())
  eventType   String   @map("event_type")    // login_failure | permission_change | token_revoked | rate_limit_breach | api_abuse
  severity    String   @default("info")      // info | warning | critical
  actor       String                         // user ID or IP that triggered the event
  resource    String?                        // affected resource (e.g. "user:123", "workspace:abc")
  summary     String
  metadata    Json?
  sourceIp    String?  @map("source_ip")
  userAgent   String?  @map("user_agent")
  createdAt   DateTime @default(now()) @map("created_at")

  @@index([eventType, createdAt])
  @@index([severity, createdAt])
  @@index([actor])
  @@index([createdAt])
  @@map("security_events")
}

// ---- NEW: security-events.service.ts ----
import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../lib/prisma.service.js";
import { AuditService } from "../../lib/audit.service.js";

export const SECURITY_EVENT_TYPES = {
  LOGIN_FAILURE: "login_failure",
  PERMISSION_CHANGE: "permission_change",
  TOKEN_REVOKED: "token_revoked",
  RATE_LIMIT_BREACH: "rate_limit_breach",
  API_ABUSE: "api_abuse",
  SUSPICIOUS_ACTIVITY: "suspicious_activity",
} as const;

export const SECURITY_SEVERITIES = {
  INFO: "info",
  WARNING: "warning",
  CRITICAL: "critical",
} as const;

export type SecurityEventType = (typeof SECURITY_EVENT_TYPES)[keyof typeof SECURITY_EVENT_TYPES];
export type SecuritySeverity = (typeof SECURITY_SEVERITIES)[keyof typeof SECURITY_SEVERITIES];

export interface CreateSecurityEventDto {
  eventType: SecurityEventType;
  severity?: SecuritySeverity;
  actor: string;
  resource?: string;
  summary: string;
  metadata?: Record<string, unknown>;
  sourceIp?: string;
  userAgent?: string;
}

export interface SecurityEventFilter {
  eventType?: SecurityEventType;
  severity?: SecuritySeverity;
  actor?: string;
  since?: string;
  until?: string;
  limit?: number;
  offset?: number;
}

@Injectable()
export class SecurityEventsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async capture(dto: CreateSecurityEventDto) {
    const event = await this.prisma.securityEvent.create({
      data: {
        eventType: dto.eventType,
        severity: dto.severity ?? SECURITY_SEVERITIES.INFO,
        actor: dto.actor,
        resource: dto.resource ?? null,
        summary: dto.summary,
        metadata: (dto.metadata ?? Prisma.JsonNull) as Prisma.InputJsonValue,
        sourceIp: dto.sourceIp ?? null,
        userAgent: dto.userAgent ?? null,
      },
    });

    // Also emit to audit service for compliance
    await this.audit.log({
      actor: dto.actor,
      action: `security.${dto.eventType}`,
      resourceType: "security_event",
      resourceId: event.id,
      summary: dto.summary,
      metadata: { severity: dto.severity, sourceIp: dto.sourceIp },
    });

    return event;
  }

  async query(filter: SecurityEventFilter) {
    const where: any = {};
    if (filter.eventType) where.eventType = filter.eventType;
    if (filter.severity) where.severity = filter.severity;
    if (filter.actor) where.actor = filter.actor;
    if (filter.since || filter.until) {
      where.createdAt = {};
      if (filter.since) where.createdAt.gte = new Date(filter.since);
      if (filter.until) where.createdAt.lte = new Date(filter.until);
    }

    return this.prisma.securityEvent.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: filter.limit ?? 50,
      skip: filter.offset ?? 0,
    });
  }

  async getStats(since?: string): Promise<{ total: number; byType: Record<string, number>; bySeverity: Record<string, number> }> {
    const where: any = {};
    if (since) where.createdAt = { gte: new Date(since) };

    const total = await this.prisma.securityEvent.count({ where });
    const byTypeRaw = await this.prisma.securityEvent.groupBy({ by: ["eventType"], where, _count: { id: true } });
    const bySeverityRaw = await this.prisma.securityEvent.groupBy({ by: ["severity"], where, _count: { id: true } });

    const byType: Record<string, number> = {};
    const bySeverity: Record<string, number> = {};
    for (const r of byTypeRaw) byType[r.eventType] = r._count.id;
    for (const r of bySeverityRaw) bySeverity[r.severity] = r._count.id;

    return { total, byType, bySeverity };
  }
}

// ---- NEW: security.controller.ts ----
@Controller("security/events")
export class SecurityEventsController {
  constructor(private readonly service: SecurityEventsService) {}

  @Get()
  query(@Query() filter: SecurityEventFilter) {
    return this.service.query(filter);
  }

  @Get("stats")
  stats(@Query("since") since?: string) {
    return this.service.getStats(since);
  }
}

// ---- Integration: capture events from existing modules ----
// In AuthService.login():
//   if (!valid) {
//     this.security.capture({
//       eventType: SECURITY_EVENT_TYPES.LOGIN_FAILURE,
//       severity: SECURITY_SEVERITIES.WARNING,
//       actor: loginDto.email,
//       sourceIp: request.ip,
//       summary: `Failed login attempt for ${loginDto.email}`,
//     });
//   }

// In RpcService (rate limit guard):
//   this.security.capture({
//     eventType: SECURITY_EVENT_TYPES.RATE_LIMIT_BREACH,
//     severity: SECURITY_SEVERITIES.CRITICAL,
//     actor: getCorrelationId() ?? "unknown",
//     summary: `Rate limit breached for method ${method}`,
//   });
