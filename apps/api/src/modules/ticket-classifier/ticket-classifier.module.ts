import { Module } from "@nestjs/common";
import { PrismaService } from "../../lib/prisma.service.js";
import { AuditService } from "../../lib/audit.service.js";
import { TicketClassifierController } from "./ticket-classifier.controller.js";
import { TicketClassifierService } from "./ticket-classifier.service.js";

@Module({
  controllers: [TicketClassifierController],
  providers: [TicketClassifierService, PrismaService, AuditService],
  exports: [TicketClassifierService],
})
export class TicketClassifierModule {}
