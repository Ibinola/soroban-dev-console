/**
 * DEVOPS-003: Single source of truth for all schema versions.
 *
 * - STORE_SCHEMA_VERSION   – Zustand persist version (bump triggers migrate())
 * - SERIALIZER_VERSION     – workspace export/import file format version
 * - API_SNAPSHOT_VERSION   – version embedded in API workspace snapshots
 *
 * All three must be kept in sync when the WorkspaceSnapshot shape changes.
 */

export const STORE_SCHEMA_VERSION = 2 as const;
export const SERIALIZER_VERSION = 2 as const;
export const API_SNAPSHOT_VERSION = 2 as const;

export type SupportedVersion = typeof STORE_SCHEMA_VERSION;

/** Versions we can migrate from. Anything outside this set is unsupported. */
export const SUPPORTED_LEGACY_VERSIONS = [1] as const;

export function assertSupportedVersion(
  version: unknown,
  context: string,
): asserts version is SupportedVersion {
  if (version !== STORE_SCHEMA_VERSION) {
    const isLegacy = (SUPPORTED_LEGACY_VERSIONS as readonly unknown[]).includes(
      version,
    );
    if (isLegacy) {
      // Caller should migrate, not throw.
      return;
    }
    throw new Error(
      `[${context}] Unsupported schema version: ${version}. ` +
        `Expected ${STORE_SCHEMA_VERSION}. ` +
        `Please export your workspace and re-import after upgrading.`,
    );
  }
}
