import { Module } from "@nestjs/common";
import { PrismaService } from "../../lib/prisma.service.js";
import { AuditService } from "../../lib/audit.service.js";
import { DomainEventBus } from "../../lib/domain-event-bus.js";
import { ReviewContextController } from "./review-context.controller.js";
import { ReviewContextService } from "./review-context.service.js";

@Module({
  controllers: [ReviewContextController],
  providers: [ReviewContextService, PrismaService, AuditService, DomainEventBus],
  exports: [ReviewContextService],
})
export class ReviewContextModule {}
