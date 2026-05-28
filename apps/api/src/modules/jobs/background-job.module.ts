import { Module } from "@nestjs/common";
import { PrismaService } from "../../lib/prisma.service.js";
import { BackgroundJobService } from "../../lib/background-job.service.js";
import { BackgroundJobController } from "./background-job.controller.js";

@Module({
  controllers: [BackgroundJobController],
  providers: [BackgroundJobService, PrismaService],
  exports: [BackgroundJobService],
})
export class BackgroundJobModule {}
