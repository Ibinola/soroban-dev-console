import { Controller, Get, Post } from "@nestjs/common";
import { RuntimeConfigService } from "./runtime-config.service.js";

@Controller("runtime-config")
export class RuntimeConfigController {
  constructor(private readonly service: RuntimeConfigService) {}

  @Get()
  get() {
    return this.service.getConfig();
  }

  /** INFRA-832: Health endpoint showing distribution status. */
  @Get("health")
  health() {
    return this.service.getLastDistribution();
  }

  /** INFRA-832: Force redistribute config. */
  @Post("redistribute")
  redistribute() {
    return this.service.redistribute();
  }
}
