import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post, Req, UseGuards } from "@nestjs/common";
import type { Request } from "express";
import { OwnerKeyGuard } from "../../auth/owner-key.guard.js";
import { GeneratePrSummaryDto, PrSummaryService } from "./pr-summary.service.js";

type OwnerKeyRequest = Request & { ownerKey: string };

@Controller("pr-summary")
@UseGuards(OwnerKeyGuard)
export class PrSummaryController {
  constructor(private readonly service: PrSummaryService) {}

  @Post("generate")
  @HttpCode(HttpStatus.OK)
  generate(@Body() dto: GeneratePrSummaryDto, @Req() req: Request) {
    return this.service.generate(dto, (req as OwnerKeyRequest).ownerKey);
  }

  @Get("pr/:pullRequestId")
  getByPr(@Param("pullRequestId") pullRequestId: string) {
    return this.service.getByPr(pullRequestId);
  }

  @Get("list")
  list() {
    return this.service.list();
  }
}
