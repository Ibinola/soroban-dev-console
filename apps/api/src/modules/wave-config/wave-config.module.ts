import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { AuditService } from "../../lib/audit.service.js";
import { PrismaService } from "../../lib/prisma.service.js";
import { WaveConfigService } from "./wave-config.service.js";
import { WaveConfigController } from "./wave-config.controller.js";

@Module({
  imports: [ConfigModule],
  controllers: [WaveConfigController],
  providers: [WaveConfigService, AuditService, PrismaService],
  exports: [WaveConfigService],
})
export class WaveConfigModule {}
