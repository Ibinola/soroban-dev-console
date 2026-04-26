/**
 * DEVOPS-003: API-side schema version constants.
 * Must stay in sync with apps/web/store/schema-version.ts.
 */

export const API_SNAPSHOT_VERSION = 2 as const;

/** Versions we can accept on import. Anything else is rejected. */
export const SUPPORTED_IMPORT_VERSIONS = [API_SNAPSHOT_VERSION] as const;

export function assertSupportedImportVersion(version: number): void {
  if (!(SUPPORTED_IMPORT_VERSIONS as readonly number[]).includes(version)) {
    throw new Error(
      `Unsupported workspace snapshot version: ${version}. ` +
        `Supported: ${SUPPORTED_IMPORT_VERSIONS.join(", ")}. ` +
        `Export your workspace from a compatible client and re-import.`,
    );
  }
}
