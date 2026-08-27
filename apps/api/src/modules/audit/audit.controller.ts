import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Query, Res, ValidationPipe } from "@nestjs/common";
import type { Response } from "express";
import { AuditService } from "../../lib/audit.service.js";
import { PruneAuditLogsDto } from "./prune-audit-logs.dto.js";
import { ListAuditDto } from "./audit.dto.js";

@Controller("audit")
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  // Issue #951: export sanitized audit logs as a downloadable JSON file.
  @Get("export")
  async exportAuditLogs(
    @Query(new ValidationPipe({ transform: true })) query: ListAuditDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    const { filename, payload } = await this.auditService.exportToJson({
      actor: query.actor,
      action: query.action,
      resourceType: query.resourceType,
      resourceId: query.resourceId,
      createdAfter: query.createdAfter,
      createdBefore: query.createdBefore,
    });

    response.setHeader("Content-Type", "application/json");
    response.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    return payload;
  }

  @Get()
  async getAuditLogs(@Query(new ValidationPipe({ transform: true })) query: ListAuditDto) {
    return this.auditService.query({
      actor: query.actor,
      action: query.action,
      resourceType: query.resourceType,
      resourceId: query.resourceId,
      skip: query.skip,
      take: query.take,
      // Optional params are only forwarded when provided so callers using
      // legacy offset pagination / no time filter keep existing behavior.
      ...(query.cursor !== undefined ? { cursor: query.cursor } : {}),
      ...(query.limit !== undefined ? { limit: query.limit } : {}),
      ...(query.createdAfter !== undefined ? { createdAfter: query.createdAfter } : {}),
      ...(query.createdBefore !== undefined ? { createdBefore: query.createdBefore } : {}),
    });
  }

  @Delete("prune")
  @HttpCode(HttpStatus.OK)
  prune(@Body() dto: PruneAuditLogsDto) {
    return this.auditService.prune(dto.olderThanDays);
  }
}