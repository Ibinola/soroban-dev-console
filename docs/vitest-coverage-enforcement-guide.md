# Vitest Coverage Enforcement Guide

This document details how we enforce code coverage thresholds in CI for Soroban Dev Console using Vitest.

## Architecture

1. **Enforcer Service**:
   - `apps/api/src/modules/devops/services/coverage-enforcer.service.ts`: Checks actual coverage against required thresholds.

2. **Web Dashboard UI**:
   - `CoverageDashboard`: React component for visualizing current coverage metrics against targets.

3. **Validation Schemas & Interfaces**:
   - `coverageReportConfigSchema` and `CoverageThresholds` defined in `@qyou/shared`.
