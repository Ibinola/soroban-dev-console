import { Module } from "@nestjs/common";
import { PrismaService } from "../../lib/prisma.service.js";
import { AuditService } from "../../lib/audit.service.js";
import { ContributorVerificationController } from "./contributor-verification.controller.js";
import { ContributorVerificationService } from "./contributor-verification.service.js";
import { ContributorVerificationRepository } from "./contributor-verification.repository.js";

@Module({
  controllers: [ContributorVerificationController],
  providers: [ContributorVerificationService, ContributorVerificationRepository, PrismaService, AuditService],
  exports: [ContributorVerificationService],
})
export class ContributorVerificationModule {}
