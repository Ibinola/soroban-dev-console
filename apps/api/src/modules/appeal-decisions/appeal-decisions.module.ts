import { Module } from "@nestjs/common";
import { PrismaService } from "../../lib/prisma.service.js";
import { AuditService } from "../../lib/audit.service.js";
import { AppealDecisionsController } from "./appeal-decisions.controller.js";
import { AppealDecisionsService } from "./appeal-decisions.service.js";
import { AppealDecisionsRepository } from "./appeal-decisions.repository.js";

@Module({
  controllers: [AppealDecisionsController],
  providers: [AppealDecisionsService, AppealDecisionsRepository, PrismaService, AuditService],
  exports: [AppealDecisionsService],
})
export class AppealDecisionsModule {}
