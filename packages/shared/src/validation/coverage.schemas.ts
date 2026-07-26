import { z } from 'zod';

export const coverageThresholdsSchema = z.object({
  statements: z.number().min(0).max(100).default(80),
  branches: z.number().min(0).max(100).default(80),
  functions: z.number().min(0).max(100).default(80),
  lines: z.number().min(0).max(100).default(80),
});

export const coverageReportConfigSchema = z.object({
  configId: z.string().min(1),
  projectPath: z.string().min(1),
  enforceThresholds: z.boolean().default(true),
  thresholds: coverageThresholdsSchema,
  excludePatterns: z.array(z.string()).default(['**/node_modules/**', '**/dist/**']),
});

export type CoverageReportConfigInput = z.infer<typeof coverageReportConfigSchema>;
