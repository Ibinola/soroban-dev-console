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
    });
  }
}
