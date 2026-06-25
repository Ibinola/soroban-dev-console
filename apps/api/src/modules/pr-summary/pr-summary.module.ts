import { Module } from "@nestjs/common";
import { PrismaService } from "../../lib/prisma.service.js";
import { AuditService } from "../../lib/audit.service.js";
import { PrSummaryController } from "./pr-summary.controller.js";
import { PrSummaryService } from "./pr-summary.service.js";

@Module({
  controllers: [PrSummaryController],
  providers: [PrSummaryService, PrismaService, AuditService],
  exports: [PrSummaryService],
})
export class PrSummaryModule {}
