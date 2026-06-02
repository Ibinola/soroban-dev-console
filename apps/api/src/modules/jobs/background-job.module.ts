import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { AuditService } from "../../lib/audit.service.js";
import { PrismaService } from "../../lib/prisma.service.js";
import { BackgroundJobService } from "../../lib/background-job.service.js";
import { BackgroundJobController } from "./background-job.controller.js";

@Module({
  imports: [ConfigModule],
  controllers: [BackgroundJobController],
  providers: [BackgroundJobService, PrismaService, AuditService],
  exports: [BackgroundJobService],
})
export class BackgroundJobModule {}
