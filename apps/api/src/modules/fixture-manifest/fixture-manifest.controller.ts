import { Controller, Get } from "@nestjs/common";
import { FixtureManifestService } from "./fixture-manifest.service.js";

import { ApiOperation, ApiTags } from "@nestjs/swagger";
@ApiTags("fixtures")
@Controller("fixture-manifest")
export class FixtureManifestController {
  constructor(private readonly service: FixtureManifestService) {}

  @ApiOperation({ summary: "Get" })
  @Get()
  get() {
    return this.service.getManifest();
  }
}
