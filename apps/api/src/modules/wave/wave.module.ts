/**
 * WaveModule — bundles BE-207, BE-208, BE-211, BE-213, AI-210 implementations.
 */

import { Module } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { PrismaService } from "../../lib/prisma.service.js";
import { AuditService } from "../../lib/audit.service.js";
import { VerificationGuard } from "../../auth/verification.guard.js";
import { EligibilityService } from "./eligibility.service.js";
import { AppealService } from "./appeal.service.js";
import { AppealController } from "./appeal.controller.js";
import { ReviewWindowService } from "./review-window.service.js";
import { ReviewWindowController } from "./review-window.controller.js";
import { AbuseRiskService } from "./abuse-risk.service.js";
import { AbuseRiskController } from "./abuse-risk.controller.js";
import { CoordinatedAbuseDetectionService } from "./coordinated-abuse-detection.service.js";

@Module({
  controllers: [AppealController, ReviewWindowController, AbuseRiskController],
  providers: [
    Reflector,
    PrismaService,
    AuditService,
    VerificationGuard,
    EligibilityService,
    AppealService,
    ReviewWindowService,
    AbuseRiskService,
    CoordinatedAbuseDetectionService,
  ],
  exports: [EligibilityService, ReviewWindowService, AbuseRiskService, CoordinatedAbuseDetectionService],
})
export class WaveModule {}
