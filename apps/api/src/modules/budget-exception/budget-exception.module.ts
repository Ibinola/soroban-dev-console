import { Module } from "@nestjs/common";
import { PrismaService } from "../../lib/prisma.service.js";
import { AuditService } from "../../lib/audit.service.js";
import { BudgetExceptionController } from "./budget-exception.controller.js";
import { BudgetExceptionService } from "./budget-exception.service.js";

@Module({
  controllers: [BudgetExceptionController],
  providers: [BudgetExceptionService, PrismaService, AuditService],
  exports: [BudgetExceptionService],
})
export class BudgetExceptionModule {}
