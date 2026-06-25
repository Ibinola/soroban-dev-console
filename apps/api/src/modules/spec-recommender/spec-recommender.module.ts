import { Module } from "@nestjs/common";
import { PrismaService } from "../../lib/prisma.service.js";
import { AuditService } from "../../lib/audit.service.js";
import { SpecRecommenderController } from "./spec-recommender.controller.js";
import { SpecRecommenderService } from "./spec-recommender.service.js";

@Module({
  controllers: [SpecRecommenderController],
  providers: [SpecRecommenderService, PrismaService, AuditService],
  exports: [SpecRecommenderService],
})
export class SpecRecommenderModule {}
