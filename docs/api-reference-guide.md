# REST API Reference Guide

This document explains the dynamic API documentation engine and the interactive endpoint reference UI in Soroban Dev Console.

## Architecture

1. **API Docs Service**:
   - `apps/api/src/modules/docs/services/api-docs.service.ts`: Extracts and manages endpoint metadata for documentation.

2. **Web Reference UI**:
   - `ApiReferenceDocs`: React UI component for interactive exploration of REST endpoints and parameter schemas.

3. **Validation Schemas & Interfaces**:
   - `apiReferenceSpecSchema` and `ApiEndpoint` defined in `@qyou/shared`.
