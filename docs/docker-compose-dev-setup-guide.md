# Docker Compose Local Dev Setup Guide

This document details the configuration for running the full-stack Soroban Dev Console locally using Docker Compose, with hot-reloading enabled.

## Architecture

1. **Docker Config Service**:
   - `apps/api/src/modules/devops/services/docker-config.service.ts`: Generates the baseline `docker-compose.yml` payload with all required environment variables and volume mappings.

2. **Web Setup Panel**:
   - `DockerComposeSetupPanel`: React component in the developer settings allowing users to download the composed dev setup.

3. **Validation Schemas & Interfaces**:
   - `dockerComposeConfigSchema` and `DockerComposeConfig` defined in `@qyou/shared`.
