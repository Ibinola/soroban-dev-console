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
  BudgetExceptionService,
  DecideExceptionDto,
  RecommendExceptionDto,
} from "./budget-exception.service.js";

type OwnerKeyRequest = Request & { ownerKey: string };

@Controller("budget-exception")
@UseGuards(OwnerKeyGuard)
export class BudgetExceptionController {
  constructor(private readonly service: BudgetExceptionService) {}

  @Post("recommend")
  @HttpCode(HttpStatus.OK)
  recommend(@Body() dto: RecommendExceptionDto, @Req() req: Request) {
    return this.service.recommend(dto, (req as OwnerKeyRequest).ownerKey);
  }

  @Get("org/:organizationId")
  getByOrg(@Param("organizationId") organizationId: string) {
    return this.service.getByOrg(organizationId);
  }

  @Patch("org/:organizationId/decide")
  decide(
    @Param("organizationId") organizationId: string,
    @Body() dto: DecideExceptionDto,
    @Req() req: Request,
  ) {
    return this.service.decide(organizationId, (req as OwnerKeyRequest).ownerKey, dto);
  }

  @Get("pending")
  listPending() {
    return this.service.listPending();
  }
}
