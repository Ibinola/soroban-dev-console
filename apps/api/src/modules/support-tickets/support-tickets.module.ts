import { Module } from "@nestjs/common";
import { PrismaService } from "../../lib/prisma.service.js";
import { AuditService } from "../../lib/audit.service.js";
import { SupportTicketsController } from "./support-tickets.controller.js";
import { SupportTicketsService } from "./support-tickets.service.js";
import { SupportTicketThrottleGuard } from "./support-ticket-throttle.guard.js";

@Module({
  controllers: [SupportTicketsController],
  providers: [SupportTicketsService, PrismaService, AuditService, SupportTicketThrottleGuard],
  exports: [SupportTicketsService],
})
export class SupportTicketsModule {}
