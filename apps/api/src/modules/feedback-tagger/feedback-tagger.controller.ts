import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post, Req, UseGuards } from "@nestjs/common";
import type { Request } from "express";
import { OwnerKeyGuard } from "../../auth/owner-key.guard.js";
import { TagFeedbackDto, FeedbackTaggerService } from "./feedback-tagger.service.js";

type OwnerKeyRequest = Request & { ownerKey: string };

@Controller("feedback-tagger")
@UseGuards(OwnerKeyGuard)
export class FeedbackTaggerController {
  constructor(private readonly service: FeedbackTaggerService) {}

  @Post("tag")
  @HttpCode(HttpStatus.OK)
  tag(@Body() dto: TagFeedbackDto, @Req() req: Request) {
    return this.service.tag(dto, (req as OwnerKeyRequest).ownerKey);
  }

  @Get("batch/:batchId")
  getByBatch(@Param("batchId") batchId: string) {
    return this.service.getByBatch(batchId);
  }

  @Get("list")
  list() {
    return this.service.list();
  }
}
