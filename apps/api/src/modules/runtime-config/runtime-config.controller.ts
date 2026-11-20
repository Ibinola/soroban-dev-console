import { BadRequestException, Body, Controller, Get, Put, Post, UseGuards } from "@nestjs/common";
import { AdminKeyGuard } from "../../common/guards/admin-key.guard.js";
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

  /** Current maintenance (read-only) mode. */
  @ApiOperation({ summary: "Get maintenance mode" })
  @UseGuards(AdminKeyGuard)
  @Get("maintenance")
  getMaintenance() {
    return this.service.getMaintenanceMode();
  }

  /** Enable or disable maintenance mode live; the change is audited. */
  @ApiOperation({ summary: "Set maintenance mode" })
  @UseGuards(AdminKeyGuard)
  @Put("maintenance")
  setMaintenance(@Body() body: { enabled?: unknown; reason?: unknown }) {
    if (typeof body?.enabled !== "boolean") {
      throw new BadRequestException({ code: "VALIDATION_ERROR", message: "enabled must be a boolean" });
    }
    if (body.reason !== undefined && typeof body.reason !== "string") {
      throw new BadRequestException({ code: "VALIDATION_ERROR", message: "reason must be a string" });
    }
    return this.service.setMaintenanceMode(body.enabled, "admin", body.reason);
  }
}
