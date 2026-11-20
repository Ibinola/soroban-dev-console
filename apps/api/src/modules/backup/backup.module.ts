import { Module } from "@nestjs/common";
import { PrismaService } from "../../lib/prisma.service.js";
import { BackupService } from "./backup.service.js";

@Module({
  providers: [BackupService, PrismaService],
  exports: [BackupService],
})
export class BackupModule {}
