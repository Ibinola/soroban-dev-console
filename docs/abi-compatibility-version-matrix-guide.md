# ABI Compatibility Version Matrix Guide

This document describes the enforcement rules and logic used by the `soroban-utils` spec validator to ensure contracts deployed to the Dev Console remain backwards-compatible.

## Architecture

1. **ABI Matrix Service**:
   - `apps/api/src/modules/contracts/services/abi-matrix.service.ts`: Implements the compatibility matrix to check `currentSpec` against supported `SUPPORTED_VERSIONS`.

2. **Web Matrix Checker**:
   - `AbiMatrixChecker`: React component rendering the results of an ABI validation check along with upgrade warnings.

3. **Validation Schemas & Interfaces**:
   - `abiCompatibilityResultSchema` and `AbiCompatibilityResult` defined in `@qyou/shared`.
