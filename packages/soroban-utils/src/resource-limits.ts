/**
 * Versioned transaction resource limit profiles.
 *
 * One source for the limits that resource warnings compare against. A profile
 * names the protocol it describes and carries its effective per-transaction
 * limits. Profiles are frozen; selecting one never exposes shared mutable
 * state, and `withLimitOverrides` returns a new object.
 *
 * NOTE: the numbers below mirror Soroban's published per-transaction network
 * settings for protocol 21 and 22 and should be re-checked against the live
 * network configuration (`getLedgerEntries` on the config setting entries)
 * before they are relied on for anything other than a warning.
 */

export interface ResourceLimits {
  /** CPU instructions per transaction. */
  cpuInstructions: number;
  /** Memory per transaction, bytes. */
  memoryBytes: number;
  /** Ledger entries a transaction may read. */
  readEntries: number;
  /** Ledger entries a transaction may write. */
  writeEntries: number;
  readBytes: number;
  writeBytes: number;
  /** Maximum serialized transaction size, bytes. */
  transactionSizeBytes: number;
  /** Maximum total size of emitted contract events, bytes. */
  eventsSizeBytes: number;
}

export interface ResourceLimitProfile {
  id: string;
  /** Human label. */
  name: string;
  /** Soroban protocol version the limits describe. */
  protocolVersion: number;
  limits: Readonly<ResourceLimits>;
}

const P21_LIMITS: ResourceLimits = {
  cpuInstructions: 100_000_000,
  memoryBytes: 41_943_040,
  readEntries: 40,
  writeEntries: 25,
  readBytes: 200_000,
  writeBytes: 132_096,
  transactionSizeBytes: 132_096,
  eventsSizeBytes: 16_384,
};

function freezeProfile(profile: ResourceLimitProfile): Readonly<ResourceLimitProfile> {
  return Object.freeze({ ...profile, limits: Object.freeze({ ...profile.limits }) });
}

const PROFILES: Readonly<Record<string, Readonly<ResourceLimitProfile>>> = Object.freeze({
  "soroban-p21": freezeProfile({ id: "soroban-p21", name: "Soroban protocol 21", protocolVersion: 21, limits: P21_LIMITS }),
  "soroban-p22": freezeProfile({ id: "soroban-p22", name: "Soroban protocol 22", protocolVersion: 22, limits: P21_LIMITS }),
});

export const DEFAULT_RESOURCE_LIMIT_PROFILE_ID = "soroban-p22";

export type ResourceLimitLookup =
  | { supported: true; profile: ResourceLimitProfile }
  | { supported: false; requested: string; available: string[] };

/** Profile ids, sorted. */
export function listResourceLimitProfileIds(): string[] {
  return Object.keys(PROFILES).sort();
}

/** All profiles, as independent copies, sorted by id. */
export function listResourceLimitProfiles(): ResourceLimitProfile[] {
  return listResourceLimitProfileIds().map((id) => cloneProfile(PROFILES[id]));
}

function cloneProfile(profile: Readonly<ResourceLimitProfile>): ResourceLimitProfile {
  return { ...profile, limits: { ...profile.limits } };
}

/**
 * Select a profile. An unknown id returns `{ supported: false }` with the ids
 * that do exist; it never silently falls back to another profile. The returned
 * profile is a copy, so callers cannot change the shared table.
 */
export function getResourceLimitProfile(id: string = DEFAULT_RESOURCE_LIMIT_PROFILE_ID): ResourceLimitLookup {
  const profile = Object.prototype.hasOwnProperty.call(PROFILES, id) ? PROFILES[id] : undefined;
  if (!profile) return { supported: false, requested: id, available: listResourceLimitProfileIds() };
  return { supported: true, profile: cloneProfile(profile) };
}

/** A new profile with some limits replaced; the source profile is untouched. */
export function withLimitOverrides(
  profile: ResourceLimitProfile,
  overrides: Partial<ResourceLimits>,
  id = `${profile.id}+custom`,
): ResourceLimitProfile {
  for (const [key, value] of Object.entries(overrides)) {
    if (!(key in profile.limits)) throw new Error(`Unknown resource limit "${key}"`);
    if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
      throw new Error(`Resource limit "${key}" must be a non-negative number`);
    }
  }
  return { ...profile, id, limits: { ...profile.limits, ...overrides } };
}
