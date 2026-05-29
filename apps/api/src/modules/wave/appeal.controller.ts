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
import { RequireVerified, VerificationGuard } from "../../auth/verification.guard.js";
import { AppealService } from "./appeal.service.js";
import type { CreateAppealDto, TransitionAppealDto } from "./appeal.service.js";

type OwnerKeyRequest = Request & { ownerKey: string };

@Controller("wave/appeals")
@UseGuards(OwnerKeyGuard, VerificationGuard)
export class AppealController {
  constructor(private readonly appealService: AppealService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @RequireVerified()
  create(@Body() dto: CreateAppealDto, @Req() req: Request) {
    return this.appealService.create((req as OwnerKeyRequest).ownerKey, dto);
  }

  @Get()
  list(@Req() req: Request) {
    return this.appealService.list((req as OwnerKeyRequest).ownerKey);
  }

  @Get(":id")
  get(@Param("id") id: string, @Req() req: Request) {
    return this.appealService.get(id, (req as OwnerKeyRequest).ownerKey);
  }

  @Patch(":id/transition")
  transition(
    @Param("id") id: string,
    @Body() dto: TransitionAppealDto,
    @Req() req: Request,
  ) {
    return this.appealService.transition(id, (req as OwnerKeyRequest).ownerKey, dto);
  }
}
