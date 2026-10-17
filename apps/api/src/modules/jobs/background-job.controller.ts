import { Controller, Get, Param, Post, Query } from "@nestjs/common";
import { BackgroundJobService } from "../../lib/background-job.service.js";
import type { JobStatus } from "../../lib/background-job.service.js";

import { ApiOperation, ApiTags } from "@nestjs/swagger";
@ApiTags("jobs")
@Controller("jobs")
export class BackgroundJobController {
  constructor(private readonly service: BackgroundJobService) {}

  @ApiOperation({ summary: "Get stats" })
  @Get("stats")
  getStats() {
    return this.service.getStats();
  }

  @ApiOperation({ summary: "Get config" })
  @Get("config")
  getConfig() {
    return this.service.getWorkerConfig();
  }

  @ApiOperation({ summary: "Find by status" })
  @Get()
  findByStatus(@Query("status") status: JobStatus = "pending") {
    return this.service.findByStatus(status);
  }

  @ApiOperation({ summary: "Find dead jobs" })
  @Get("dead")
  findDeadJobs() {
    return this.service.findByStatus("dead");
  }

  @ApiOperation({ summary: "Replay" })
  @Post(":id/replay")
  replay(@Param("id") id: string) {
    return this.service.replay(id);
  }
}
