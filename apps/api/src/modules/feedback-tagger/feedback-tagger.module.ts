import { Module } from "@nestjs/common";
import { PrismaService } from "../../lib/prisma.service.js";
import { AuditService } from "../../lib/audit.service.js";
import { FeedbackTaggerController } from "./feedback-tagger.controller.js";
import { FeedbackTaggerService } from "./feedback-tagger.service.js";

@Module({
  controllers: [FeedbackTaggerController],
  providers: [FeedbackTaggerService, PrismaService, AuditService],
  exports: [FeedbackTaggerService],
})
export class FeedbackTaggerModule {}
