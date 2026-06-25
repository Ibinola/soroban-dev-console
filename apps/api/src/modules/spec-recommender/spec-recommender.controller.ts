import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post, Req, UseGuards } from "@nestjs/common";
import type { Request } from "express";
import { OwnerKeyGuard } from "../../auth/owner-key.guard.js";
import { RecommendSpecsDto, SpecRecommenderService } from "./spec-recommender.service.js";

type OwnerKeyRequest = Request & { ownerKey: string };

@Controller("spec-recommender")
@UseGuards(OwnerKeyGuard)
export class SpecRecommenderController {
  constructor(private readonly service: SpecRecommenderService) {}

  @Post("recommend")
  @HttpCode(HttpStatus.OK)
  recommend(@Body() dto: RecommendSpecsDto, @Req() req: Request) {
    return this.service.recommend(dto, (req as OwnerKeyRequest).ownerKey);
  }

  @Get("change-set/:changeSetId")
  getByChangeSet(@Param("changeSetId") changeSetId: string) {
    return this.service.getByChangeSet(changeSetId);
  }

  @Get("list")
  list() {
    return this.service.list();
  }
}
