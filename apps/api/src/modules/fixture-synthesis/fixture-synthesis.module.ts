import { Module } from "@nestjs/common";
import { PrismaService } from "../../lib/prisma.service.js";
import { AuditService } from "../../lib/audit.service.js";
import { FixtureSynthesisController } from "./fixture-synthesis.controller.js";
import { FixtureSynthesisService } from "./fixture-synthesis.service.js";

@Module({
  controllers: [FixtureSynthesisController],
  providers: [FixtureSynthesisService, PrismaService, AuditService],
  exports: [FixtureSynthesisService],
})
export class FixtureSynthesisModule {}
