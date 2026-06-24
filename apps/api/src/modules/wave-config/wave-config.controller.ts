import { Body, Controller, Get, Param, Patch, Query } from "@nestjs/common";
import { WaveConfigService } from "./wave-config.service.js";
import type { WaveFeatureKey, SetFeatureFlagPayload } from "@devconsole/api-contracts";

@Controller("wave-config")
export class WaveConfigController {
  constructor(private readonly service: WaveConfigService) {}

  /** Get all Wave 5 feature flags and runtime controls. */
  @Get("flags")
  getControls() {
    return this.service.getControls();
  }

  /** Get a single feature flag by key. */
  @Get("flags/:key")
  getFlag(@Param("key") key: WaveFeatureKey) {
    return this.service.getFlag(key);
  }

  /** Override a feature flag at runtime. */
  @Patch("flags/:key")
  setFlag(@Param("key") key: WaveFeatureKey, @Body() body: SetFeatureFlagPayload) {
    return this.service.setFlag(key, body);
  }

  /** Check whether a flag is active for a contributor (for client-side gating). */
  @Get("flags/:key/check")
  check(
    @Param("key") key: WaveFeatureKey,
    @Query("contributorId") contributorId?: string,
  ) {
    return { key, enabled: this.service.isEnabled(key, contributorId) };
  }
}
