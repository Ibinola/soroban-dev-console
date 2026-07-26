import {
  coverageReportConfigSchema,
  type CoverageReportConfig,
  type CoverageThresholds,
} from '@qyou/shared';

export class CoverageEnforcerService {
  public enforceThresholds(config: CoverageReportConfig, actual: CoverageThresholds): boolean {
    const validated = coverageReportConfigSchema.parse(config);
    if (!validated.enforceThresholds) return true;

    const t = validated.thresholds;
    if (actual.statements < t.statements) return false;
    if (actual.branches < t.branches) return false;
    if (actual.functions < t.functions) return false;
    if (actual.lines < t.lines) return false;

    return true;
  }
}
