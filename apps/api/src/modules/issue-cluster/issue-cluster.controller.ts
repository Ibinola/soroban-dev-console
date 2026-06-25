import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post, Req, UseGuards } from "@nestjs/common";
import type { Request } from "express";
import { OwnerKeyGuard } from "../../auth/owner-key.guard.js";
import { ClusterIssuesDto, IssueClusterService } from "./issue-cluster.service.js";

type OwnerKeyRequest = Request & { ownerKey: string };

@Controller("issue-cluster")
@UseGuards(OwnerKeyGuard)
export class IssueClusterController {
  constructor(private readonly service: IssueClusterService) {}

  @Post("cluster")
  @HttpCode(HttpStatus.OK)
  cluster(@Body() dto: ClusterIssuesDto, @Req() req: Request) {
    return this.service.cluster(dto, (req as OwnerKeyRequest).ownerKey);
  }

  @Get("list")
  list() {
    return this.service.list();
  }

  @Get(":clusterKey")
  getCluster(@Param("clusterKey") clusterKey: string) {
    return this.service.getCluster(clusterKey);
  }
}
