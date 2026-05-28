import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post } from "@nestjs/common";
import { ReviewContextService } from "./review-context.service.js";
import type { ReviewContextPayload } from "@devconsole/api-contracts";

@Controller("review-context")
export class ReviewContextController {
  constructor(private readonly service: ReviewContextService) {}

  /** Record a maintainer review event. */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  record(@Body() payload: ReviewContextPayload) {
    return this.service.record(payload);
  }

  /** Get aggregated appeal context for a pull request. */
  @Get("pull-requests/:pullRequestId/appeal-context")
  getAppealContext(@Param("pullRequestId") pullRequestId: string) {
    return this.service.getAppealContext(pullRequestId);
  }

  /** List all review contexts for a repository. */
  @Get("repositories/:repositoryId")
  findByRepository(@Param("repositoryId") repositoryId: string) {
    return this.service.findByRepository(repositoryId);
  }
}
