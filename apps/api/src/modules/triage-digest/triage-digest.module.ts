import { Module } from "@nestjs/common";
import { PrismaService } from "../../lib/prisma.service.js";
import { AuditService } from "../../lib/audit.service.js";
import { TriageDigestController } from "./triage-digest.controller.js";
import { TriageDigestService } from "./triage-digest.service.js";

@Module({
  controllers: [TriageDigestController],
  providers: [TriageDigestService, PrismaService, AuditService],
  exports: [TriageDigestService],
})
export class TriageDigestModule {}
