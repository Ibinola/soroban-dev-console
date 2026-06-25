import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post, Req, UseGuards } from "@nestjs/common";
import type { Request } from "express";
import { OwnerKeyGuard } from "../../auth/owner-key.guard.js";
import { RecommendWorkflowDto, WorkflowRecommenderService } from "./workflow-recommender.service.js";

type OwnerKeyRequest = Request & { ownerKey: string };

@Controller("workflow-recommender")
@UseGuards(OwnerKeyGuard)
export class WorkflowRecommenderController {
  constructor(private readonly service: WorkflowRecommenderService) {}

  @Post("recommend")
  @HttpCode(HttpStatus.OK)
  recommend(@Body() dto: RecommendWorkflowDto, @Req() req: Request) {
    return this.service.recommend(dto, (req as OwnerKeyRequest).ownerKey);
  }

  @Get("task/:taskId")
  getByTask(@Param("taskId") taskId: string) {
    return this.service.getByTask(taskId);
  }

  @Get("list")
  list() {
    return this.service.list();
  }
}
