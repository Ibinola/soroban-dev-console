import { Module } from "@nestjs/common";
import { PrismaService } from "../../lib/prisma.service.js";
import { AuditService } from "../../lib/audit.service.js";
import { ContractDiffExplainerController } from "./contract-diff-explainer.controller.js";
import { ContractDiffExplainerService } from "./contract-diff-explainer.service.js";

@Module({
  controllers: [ContractDiffExplainerController],
  providers: [ContractDiffExplainerService, PrismaService, AuditService],
  exports: [ContractDiffExplainerService],
})
export class ContractDiffExplainerModule {}
