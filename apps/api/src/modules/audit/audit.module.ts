import { Module } from "@nestjs/common";
import { AuditController } from "./audit.controller.js";
import { AuditService } from "../../lib/audit.service.js";

@Module({
  controllers: [AuditController],
  providers: [AuditService],
  exports: [AuditService],
})
export class AuditModule {}
