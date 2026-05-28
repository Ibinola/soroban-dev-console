import { Controller, Get, Query } from "@nestjs/common";
import { BackgroundJobService } from "../../lib/background-job.service.js";
import type { JobStatus } from "../../lib/background-job.service.js";

@Controller("jobs")
export class BackgroundJobController {
  constructor(private readonly service: BackgroundJobService) {}

  @Get("stats")
  getStats() {
    return this.service.getStats();
  }

  @Get()
  findByStatus(@Query("status") status: JobStatus = "pending") {
    return this.service.findByStatus(status);
  }
}
