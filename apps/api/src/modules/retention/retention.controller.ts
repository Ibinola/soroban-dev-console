import { Controller, Get, Post, Query } from "@nestjs/common";
import { RetentionService } from "./retention.service.js";

@Controller("retention")
export class RetentionController {
  constructor(private readonly service: RetentionService) {}

  /** Return the configured retention policies for operator visibility. */
  @Get("policies")
  policies() {
    return this.service.policies();
  }

  /**
   * Trigger a retention run.
   * Pass ?dryRun=true to preview without deleting.
   * Operators can verify health and expected impact before committing.
   */
  @Post("run")
  run(@Query("dryRun") dryRun?: string) {
    return this.service.runAll(dryRun === "true");
  }
}
