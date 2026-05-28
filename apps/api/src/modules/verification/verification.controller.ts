import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post } from "@nestjs/common";
import { VerificationService } from "./verification.service.js";
import type { VerificationEventPayload } from "@devconsole/api-contracts";

@Controller("verification")
export class VerificationController {
  constructor(private readonly service: VerificationService) {}

  /** Ingest a verification event from an external provider. Idempotent. */
  @Post("events")
  @HttpCode(HttpStatus.CREATED)
  ingest(@Body() payload: VerificationEventPayload) {
    return this.service.ingest(payload);
  }

  /** Retrieve all verification events for a contributor. */
  @Get("contributors/:contributorId/events")
  findByContributor(@Param("contributorId") contributorId: string) {
    return this.service.findByContributor(contributorId);
  }
}
