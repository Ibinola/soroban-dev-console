import { Module } from "@nestjs/common";
import { PrismaService } from "../../lib/prisma.service.js";
import { AuditService } from "../../lib/audit.service.js";
import { CiFailureSummaryController } from "./ci-failure-summary.controller.js";
import { CiFailureSummaryService } from "./ci-failure-summary.service.js";

@Module({
  controllers: [CiFailureSummaryController],
  providers: [CiFailureSummaryService, PrismaService, AuditService],
  exports: [CiFailureSummaryService],
})
export class CiFailureSummaryModule {}
