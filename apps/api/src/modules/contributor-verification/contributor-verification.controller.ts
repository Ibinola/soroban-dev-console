import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Put,
  UseGuards,
} from "@nestjs/common";
import { OwnerKeyGuard } from "../../auth/owner-key.guard.js";
import { ContributorVerificationService } from "./contributor-verification.service.js";
import type { UpsertVerificationDto } from "./contributor-verification.service.js";

@Controller("contributor-verifications")
@UseGuards(OwnerKeyGuard)
export class ContributorVerificationController {
  constructor(private readonly service: ContributorVerificationService) {}

  @Get()
  list() {
    return this.service.list();
  }

  @Get(":contributorId")
  get(@Param("contributorId") contributorId: string) {
    return this.service.get(contributorId);
  }

  @Get(":contributorId/eligibility")
  eligibility(@Param("contributorId") contributorId: string) {
    return this.service.isEligible(contributorId);
  }

  @Put(":contributorId")
  @HttpCode(HttpStatus.OK)
  upsert(@Param("contributorId") contributorId: string, @Body() dto: UpsertVerificationDto) {
    return this.service.upsert({ ...dto, contributorId });
  }
}
