import { Controller, Get, Post } from "@nestjs/common";
import { RuntimeConfigService } from "./runtime-config.service.js";

import { ApiOperation, ApiTags } from "@nestjs/swagger";
@ApiTags("runtime-config")
@Controller("runtime-config")
export class RuntimeConfigController {
  constructor(private readonly service: RuntimeConfigService) {}

  @ApiOperation({ summary: "Get" })
  @Get()
  get() {
    return this.service.getConfig();
  }

  /** INFRA-832: Health endpoint showing distribution status. */
  @ApiOperation({ summary: "Health" })
  @Get("health")
  health() {
    return this.service.getLastDistribution();
  }

  /** INFRA-832: Force redistribute config. */
  @ApiOperation({ summary: "Redistribute" })
  @Post("redistribute")
  redistribute() {
    return this.service.redistribute();
  }

  /** #776: Hot-reload feature flags without restarting the API. */
  @ApiOperation({ summary: "Reload" })
  @Post("reload")
  reload() {
    return this.service.reload();
  }
}
