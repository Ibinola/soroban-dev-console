import { Module } from "@nestjs/common";
import { PrismaService } from "../../lib/prisma.service.js";
import { AuditService } from "../../lib/audit.service.js";
import { LogAnalyzerController } from "./log-analyzer.controller.js";
import { LogAnalyzerService } from "./log-analyzer.service.js";

@Module({
  controllers: [LogAnalyzerController],
  providers: [LogAnalyzerService, PrismaService, AuditService],
  exports: [LogAnalyzerService],
})
export class LogAnalyzerModule {}
