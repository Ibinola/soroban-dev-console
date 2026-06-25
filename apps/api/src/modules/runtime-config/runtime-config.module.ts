import { Module } from "@nestjs/common";
import { AuditService } from "../../lib/audit.service.js";
import { PrismaService } from "../../lib/prisma.service.js";
import { RuntimeConfigController } from "./runtime-config.controller.js";
import { RuntimeConfigService } from "./runtime-config.service.js";

@Module({
  controllers: [RuntimeConfigController],
  providers: [RuntimeConfigService, AuditService, PrismaService],
  exports: [RuntimeConfigService],
})
export class RuntimeConfigModule {}
