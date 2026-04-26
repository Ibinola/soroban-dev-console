/**
 * Canonical runtime defaults for the Soroban DevConsole ecosystem.
 * DEVOPS-025: Centralized source of truth to prevent port and URL drift.
 */

export const DEFAULT_API_PORT = 4000;
export const DEFAULT_WEB_PORT = 3000;
export const DEFAULT_HORIZON_PORT = 8000;

export const DEFAULT_LOCAL_API_URL = `http://localhost:${DEFAULT_API_PORT}`;
export const DEFAULT_LOCAL_WEB_URL = `http://localhost:${DEFAULT_WEB_PORT}`;
export const DEFAULT_LOCAL_HORIZON_URL = `http://localhost:${DEFAULT_HORIZON_PORT}`;
