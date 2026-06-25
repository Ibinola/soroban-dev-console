import { Module } from "@nestjs/common";
import { PrismaService } from "../../lib/prisma.service.js";
import { AuditService } from "../../lib/audit.service.js";
import { ReleaseNotesController } from "./release-notes.controller.js";
import { ReleaseNotesService } from "./release-notes.service.js";

@Module({
  controllers: [ReleaseNotesController],
  providers: [ReleaseNotesService, PrismaService, AuditService],
  exports: [ReleaseNotesService],
})
export class ReleaseNotesModule {}
