import { Module } from "@nestjs/common";
import { PrismaService } from "../../lib/prisma.service.js";
import { AuditService } from "../../lib/audit.service.js";
import { PromptPolicyService } from "./prompt-policy.service.js";
import { PromptPolicyController } from "./prompt-policy.controller.js";

@Module({
  controllers: [PromptPolicyController],
  providers: [PromptPolicyService, PrismaService, AuditService],
  exports: [PromptPolicyService],
})
export class PromptPolicyModule {}
