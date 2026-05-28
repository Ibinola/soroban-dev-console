import { Module } from "@nestjs/common";
import { PrismaService } from "../../lib/prisma.service.js";
import { AuditService } from "../../lib/audit.service.js";
import { PointLedgerController } from "./point-ledger.controller.js";
import { PointLedgerService } from "./point-ledger.service.js";

@Module({
  controllers: [PointLedgerController],
  providers: [PointLedgerService, PrismaService, AuditService],
  exports: [PointLedgerService],
})
export class PointLedgerModule {}
