import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post, Req, UseGuards } from "@nestjs/common";
import type { Request } from "express";
import { OwnerKeyGuard } from "../../auth/owner-key.guard.js";
import { SummarizeCiFailureDto, CiFailureSummaryService } from "./ci-failure-summary.service.js";

type OwnerKeyRequest = Request & { ownerKey: string };

@Controller("ci-failure-summary")
@UseGuards(OwnerKeyGuard)
export class CiFailureSummaryController {
  constructor(private readonly service: CiFailureSummaryService) {}

  @Post("summarize")
  @HttpCode(HttpStatus.OK)
  summarize(@Body() dto: SummarizeCiFailureDto, @Req() req: Request) {
    return this.service.summarize(dto, (req as OwnerKeyRequest).ownerKey);
  }

  @Get("run/:runId")
  getByRunId(@Param("runId") runId: string) {
    return this.service.getByRunId(runId);
  }

  @Get("list")
  list() {
    return this.service.list();
  }
}
