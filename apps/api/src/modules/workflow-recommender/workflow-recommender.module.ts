import { Module } from "@nestjs/common";
import { PrismaService } from "../../lib/prisma.service.js";
import { AuditService } from "../../lib/audit.service.js";
import { WorkflowRecommenderController } from "./workflow-recommender.controller.js";
import { WorkflowRecommenderService } from "./workflow-recommender.service.js";

@Module({
  controllers: [WorkflowRecommenderController],
  providers: [WorkflowRecommenderService, PrismaService, AuditService],
  exports: [WorkflowRecommenderService],
})
export class WorkflowRecommenderModule {}
