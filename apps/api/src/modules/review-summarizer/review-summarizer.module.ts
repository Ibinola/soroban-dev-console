import { Module } from "@nestjs/common";
import { PrismaService } from "../../lib/prisma.service.js";
import { AuditService } from "../../lib/audit.service.js";
import { ReviewSummarizerController } from "./review-summarizer.controller.js";
import { ReviewSummarizerService } from "./review-summarizer.service.js";

@Module({
  controllers: [ReviewSummarizerController],
  providers: [ReviewSummarizerService, PrismaService, AuditService],
  exports: [ReviewSummarizerService],
})
export class ReviewSummarizerModule {}
