import { Module } from "@nestjs/common";
import { PrismaService } from "../../lib/prisma.service.js";
import { AuditService } from "../../lib/audit.service.js";
import { DomainEventBus } from "../../lib/domain-event-bus.js";
import { VerificationController } from "./verification.controller.js";
import { VerificationService } from "./verification.service.js";

@Module({
  controllers: [VerificationController],
  providers: [VerificationService, PrismaService, AuditService, DomainEventBus],
  exports: [VerificationService],
})
export class VerificationModule {}
