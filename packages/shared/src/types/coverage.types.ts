export interface CoverageThresholds {
  statements: number;
  branches: number;
  functions: number;
  lines: number;
}

export interface CoverageReportConfig {
  configId: string;
  projectPath: string;
  enforceThresholds: boolean;
  thresholds: CoverageThresholds;
  excludePatterns: string[];
}
