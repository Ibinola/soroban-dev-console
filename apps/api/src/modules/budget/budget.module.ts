import { Module } from "@nestjs/common";
import { PrismaService } from "../../lib/prisma.service.js";
import { BudgetService } from "./budget.service.js";

@Module({
  providers: [BudgetService, PrismaService],
  exports: [BudgetService],
})
export class BudgetModule {}
