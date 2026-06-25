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

  /** INFRA-831: Return the operational status of the retention lifecycle. */
  @Get("status")
  status() {
    return this.service.getStatus();
  }

  /** INFRA-831: Return run history for operational visibility. */
  @Get("history")
  history(@Query("limit") limit?: string) {
    return this.service.getRunHistory(limit ? Number(limit) : 10);
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
