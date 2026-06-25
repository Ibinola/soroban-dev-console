import { Module } from "@nestjs/common";
import { PrismaService } from "../../lib/prisma.service.js";
import { AuditService } from "../../lib/audit.service.js";
import { ChangeImpactController } from "./change-impact.controller.js";
import { ChangeImpactService } from "./change-impact.service.js";

@Module({
  controllers: [ChangeImpactController],
  providers: [ChangeImpactService, PrismaService, AuditService],
  exports: [ChangeImpactService],
})
export class ChangeImpactModule {}
