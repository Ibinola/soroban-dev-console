import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  UseGuards,
} from "@nestjs/common";
import { OwnerKeyGuard } from "../../auth/owner-key.guard.js";
import { AppealDecisionsService } from "./appeal-decisions.service.js";
import type { RecordAppealDecisionDto } from "./appeal-decisions.service.js";

@Controller("appeal-decisions")
@UseGuards(OwnerKeyGuard)
export class AppealDecisionsController {
  constructor(private readonly service: AppealDecisionsService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  record(@Body() dto: RecordAppealDecisionDto) {
    return this.service.record(dto);
  }

  @Get(":id")
  get(@Param("id") id: string) {
    return this.service.get(id);
  }

  @Get("by-appeal/:appealId")
  listByAppeal(@Param("appealId") appealId: string) {
    return this.service.listByAppeal(appealId);
  }

  @Get("by-contributor/:contributorId")
  listByContributor(@Param("contributorId") contributorId: string) {
    return this.service.listByContributor(contributorId);
  }
}
