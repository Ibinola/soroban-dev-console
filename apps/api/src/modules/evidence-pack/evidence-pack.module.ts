import { Module } from "@nestjs/common";
import { PrismaService } from "../../lib/prisma.service.js";
import { EvidencePackController } from "./evidence-pack.controller.js";
import { EvidencePackService } from "./evidence-pack.service.js";

@Module({
  controllers: [EvidencePackController],
  providers: [EvidencePackService, PrismaService],
  exports: [EvidencePackService],
})
export class EvidencePackModule {}
