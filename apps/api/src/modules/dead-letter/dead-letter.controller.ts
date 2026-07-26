import { Controller, Get, Param, Post, Query } from "@nestjs/common";
import { DeadLetterService } from "./dead-letter.service.js";

@Controller("dead-letter")
export class DeadLetterController {
  constructor(private readonly deadLetterService: DeadLetterService) {}

  @Get()
  list(@Query("status") status?: string) {
    return this.deadLetterService.list(status);
  }

  @Post("retry/:id")
  retry(@Param("id") id: string) {
    return this.deadLetterService.retry(id);
  }

  @Get("stats")
  stats() {
    return this.deadLetterService.getStats();
  }
}
