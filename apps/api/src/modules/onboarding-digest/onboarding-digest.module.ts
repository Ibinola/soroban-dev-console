import { Module } from "@nestjs/common";
import { PrismaService } from "../../lib/prisma.service.js";
import { AuditService } from "../../lib/audit.service.js";
import { OnboardingDigestController } from "./onboarding-digest.controller.js";
import { OnboardingDigestService } from "./onboarding-digest.service.js";

@Module({
  controllers: [OnboardingDigestController],
  providers: [OnboardingDigestService, PrismaService, AuditService],
  exports: [OnboardingDigestService],
})
export class OnboardingDigestModule {}
