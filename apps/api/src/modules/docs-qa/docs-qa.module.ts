import { Module } from "@nestjs/common";
import { PrismaService } from "../../lib/prisma.service.js";
import { AuditService } from "../../lib/audit.service.js";
import { DocsQaController } from "./docs-qa.controller.js";
import { DocsQaService } from "./docs-qa.service.js";

@Module({
  controllers: [DocsQaController],
  providers: [DocsQaService, PrismaService, AuditService],
  exports: [DocsQaService],
})
export class DocsQaModule {}
