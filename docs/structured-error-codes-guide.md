# Structured API Error Codes Guide

This document explains the standard machine-readable error format used across all REST APIs in the Soroban Dev Console.

## Architecture

1. **Error Handler Service**:
   - `apps/api/src/modules/core/services/error-handler.service.ts`: Translates internal exceptions into structured `ApiErrorResponse` payloads with request IDs.

2. **Web Error Display**:
   - `ErrorDisplay`: React component rendering standard error formats consistently across the frontend.

3. **Validation Schemas & Interfaces**:
   - `apiErrorResponseSchema` and `ErrorCode` defined in `@qyou/shared`.
