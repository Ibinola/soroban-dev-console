import { Controller, Get, Query, ValidationPipe } from "@nestjs/common";
import { AuditService } from "../../lib/audit.service.js";
import { ListAuditDto } from "./audit.dto.js";

@Controller("audit")
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get()
  async getAuditLogs(@Query(new ValidationPipe({ transform: true })) query: ListAuditDto) {
    return this.auditService.query({
      actor: query.actor,
      action: query.action,
      resourceType: query.resourceType,
      resourceId: query.resourceId,
      skip: query.skip,
      take: query.take,
      // Cursor-based pagination params are only forwarded when provided so
      // callers using legacy offset pagination keep their existing behavior.
      ...(query.cursor !== undefined ? { cursor: query.cursor } : {}),
      ...(query.limit !== undefined ? { limit: query.limit } : {}),
    });
  }
}
