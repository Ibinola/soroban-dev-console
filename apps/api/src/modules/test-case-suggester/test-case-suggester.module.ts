import { Module } from "@nestjs/common";
import { PrismaService } from "../../lib/prisma.service.js";
import { AuditService } from "../../lib/audit.service.js";
import { TestCaseSuggesterController } from "./test-case-suggester.controller.js";
import { TestCaseSuggesterService } from "./test-case-suggester.service.js";

@Module({
  controllers: [TestCaseSuggesterController],
  providers: [TestCaseSuggesterService, PrismaService, AuditService],
  exports: [TestCaseSuggesterService],
})
export class TestCaseSuggesterModule {}
