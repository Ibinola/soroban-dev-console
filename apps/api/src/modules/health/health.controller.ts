import { Controller, Get } from "@nestjs/common";

@Controller()
export class HealthController {
  @Get("health")
  getHealth() {
    return {
      ok: true,
      service: "api",
      version: process.env.npm_package_version ?? "0.1.0",
      timestamp: new Date().toISOString()
    };
  }

  @Get("version")
  getVersion() {
    return {
      service: "api",
      version: process.env.npm_package_version ?? "0.1.0"
    };
  }
}
