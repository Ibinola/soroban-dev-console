import { Controller, Get } from "@nestjs/common";
import { RuntimeConfigService } from "./runtime-config.service.js";

@Controller("runtime-config")
export class RuntimeConfigController {
  constructor(private readonly service: RuntimeConfigService) {}

  @Get()
  get() {
    return this.service.getConfig();
  }
}
