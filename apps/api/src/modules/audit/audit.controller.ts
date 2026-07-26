import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Query } from "@nestjs/common";
import { AuditService } from "../../lib/audit.service.js";
import { PruneAuditLogsDto } from "./prune-audit-logs.dto.js";

@Controller("audit")
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get()
  list(@Query("retention") retention?: string) {
    const days = retention ? Number(retention) : undefined;
    return this.auditService.findAll(days);
  }

  @Delete("prune")
  @HttpCode(HttpStatus.OK)
  prune(@Body() dto: PruneAuditLogsDto) {
    return this.auditService.prune(dto.olderThanDays);
  }
}
