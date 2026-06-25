import { Module } from "@nestjs/common";
import { PrismaService } from "../../lib/prisma.service.js";
import { AuditService } from "../../lib/audit.service.js";
import { AiMonitorController } from "./ai-monitor.controller.js";
import { AiMonitorService } from "./ai-monitor.service.js";

@Module({
  controllers: [AiMonitorController],
  providers: [AiMonitorService, PrismaService, AuditService],
  exports: [AiMonitorService],
})
export class AiMonitorModule {}
