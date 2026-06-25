import { Module } from "@nestjs/common";
import { PrismaService } from "../../lib/prisma.service.js";
import { AuditService } from "../../lib/audit.service.js";
import { RetentionService } from "./retention.service.js";
import { RetentionController } from "./retention.controller.js";

@Module({
  controllers: [RetentionController],
  providers: [RetentionService, PrismaService, AuditService],
  exports: [RetentionService],
})
export class RetentionModule {}
