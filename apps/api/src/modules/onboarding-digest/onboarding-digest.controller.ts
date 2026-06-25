import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post, Req, UseGuards } from "@nestjs/common";
import type { Request } from "express";
import { OwnerKeyGuard } from "../../auth/owner-key.guard.js";
import { GenerateOnboardingDigestDto, OnboardingDigestService } from "./onboarding-digest.service.js";

type OwnerKeyRequest = Request & { ownerKey: string };

@Controller("onboarding-digest")
@UseGuards(OwnerKeyGuard)
export class OnboardingDigestController {
  constructor(private readonly service: OnboardingDigestService) {}

  @Post("generate")
  @HttpCode(HttpStatus.OK)
  generate(@Body() dto: GenerateOnboardingDigestDto, @Req() req: Request) {
    return this.service.generate(dto, (req as OwnerKeyRequest).ownerKey);
  }

  @Get("contributor/:contributorKey")
  getByContributor(@Param("contributorKey") contributorKey: string) {
    return this.service.getByContributor(contributorKey);
  }

  @Get("list")
  list() {
    return this.service.list();
  }
}
