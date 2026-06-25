import { Module } from "@nestjs/common";
import { PrismaService } from "../../lib/prisma.service.js";
import { AuditService } from "../../lib/audit.service.js";
import { AiEscalationController } from "./ai-escalation.controller.js";
import { AiEscalationService } from "./ai-escalation.service.js";

@Module({
  controllers: [AiEscalationController],
  providers: [AiEscalationService, PrismaService, AuditService],
  exports: [AiEscalationService],
})
export class AiEscalationModule {}
