import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post } from "@nestjs/common";
import { ReviewContextService } from "./review-context.service.js";
import { ReviewContextPreprocessorService } from "./review-context-preprocessor.service.js";
import type { ReviewContextPayload } from "@devconsole/api-contracts";

@Controller("review-context")
export class ReviewContextController {
  constructor(
    private readonly service: ReviewContextService,
    private readonly preprocessor: ReviewContextPreprocessorService,
  ) {}

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

  /**
   * AI-202: Preprocess review context into an AI-ready representation.
   * Returns an explicit signal, confidence score, and human-override flag.
   */
  @Get("pull-requests/:pullRequestId/ai-ready")
  getAIReadyContext(@Param("pullRequestId") pullRequestId: string) {
    return this.preprocessor.preprocess(pullRequestId);
  }

  /** List all review contexts for a repository. */
  @Get("repositories/:repositoryId")
  findByRepository(@Param("repositoryId") repositoryId: string) {
    return this.service.findByRepository(repositoryId);
  }
}
