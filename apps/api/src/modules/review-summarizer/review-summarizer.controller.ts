import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from "@nestjs/common";
import type { Request } from "express";
import { OwnerKeyGuard } from "../../auth/owner-key.guard.js";
import {
  SummarizeReviewDto,
  OverrideSummaryDto,
  ReviewSummarizerService,
} from "./review-summarizer.service.js";

type OwnerKeyRequest = Request & { ownerKey: string };

@Controller("review-summarizer")
@UseGuards(OwnerKeyGuard)
export class ReviewSummarizerController {
  constructor(private readonly service: ReviewSummarizerService) {}

  @Post("summarize")
  @HttpCode(HttpStatus.OK)
  summarize(@Body() dto: SummarizeReviewDto, @Req() req: Request) {
    return this.service.summarize(dto, (req as OwnerKeyRequest).ownerKey);
  }

  @Get("pr/:pullRequestId")
  getByPr(@Param("pullRequestId") pullRequestId: string) {
    return this.service.getByPr(pullRequestId);
  }

  @Patch("pr/:pullRequestId/override")
  override(
    @Param("pullRequestId") pullRequestId: string,
    @Body() dto: OverrideSummaryDto,
    @Req() req: Request,
  ) {
    return this.service.override(
      pullRequestId,
      (req as OwnerKeyRequest).ownerKey,
      dto,
    );
  }

  @Get("list")
  list() {
    return this.service.list();
  }
}
