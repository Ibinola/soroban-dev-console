import { Module } from "@nestjs/common";
import { PrismaService } from "../../lib/prisma.service.js";
import { AuditService } from "../../lib/audit.service.js";
import { IssueClusterController } from "./issue-cluster.controller.js";
import { IssueClusterService } from "./issue-cluster.service.js";

@Module({
  controllers: [IssueClusterController],
  providers: [IssueClusterService, PrismaService, AuditService],
  exports: [IssueClusterService],
})
export class IssueClusterModule {}
