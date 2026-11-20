import { Controller, Get, Param, Post, Query } from "@nestjs/common";
import { DeadLetterService } from "./dead-letter.service.js";

import { ApiOperation, ApiTags } from "@nestjs/swagger";
@ApiTags("dead-letter")
@Controller("dead-letter")
export class DeadLetterController {
  constructor(private readonly deadLetterService: DeadLetterService) {}

  @ApiOperation({ summary: "List" })
  @Get()
  list(
    @Query("status") status?: string,
    @Query("page") page?: string,
    @Query("pageSize") pageSize?: string,
    @Query("skip") skip?: string,
    @Query("take") take?: string,
  ) {
    return this.deadLetterService.list({
      status,
      page: page ? Number(page) : undefined,
      pageSize: pageSize ? Number(pageSize) : undefined,
      skip: skip ? Number(skip) : undefined,
      take: take ? Number(take) : undefined,
    });
  }

  @ApiOperation({ summary: "Retry" })
  @Post("retry/:id")
  retry(@Param("id") id: string) {
    return this.deadLetterService.retry(id);
  }

  @ApiOperation({ summary: "Stats" })
  @Get("stats")
  stats() {
    return this.deadLetterService.getStats();
  }
}
