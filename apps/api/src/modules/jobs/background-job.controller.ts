import { Controller, Get, Param, Post, Query } from "@nestjs/common";
import { BackgroundJobService } from "../../lib/background-job.service.js";
import type { JobStatus } from "../../lib/background-job.service.js";

@Controller("jobs")
export class BackgroundJobController {
  constructor(private readonly service: BackgroundJobService) {}

  @Get("stats")
  getStats() {
    return this.service.getStats();
  }

  @Get("config")
  getConfig() {
    return this.service.getWorkerConfig();
  }

  @Get()
  findByStatus(@Query("status") status: JobStatus = "pending") {
    return this.service.findByStatus(status);
  }

  @Get("dead")
  findDeadJobs() {
    return this.service.findByStatus("dead");
  }

  @Post(":id/replay")
  replay(@Param("id") id: string) {
    return this.service.replay(id);
  }
}
