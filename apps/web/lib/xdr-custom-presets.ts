/**
 * Issue #1113: user-defined XDR presets stored in browser local storage.
 *
 * Everything except `getBrowserStorage()` is pure so the storage layer can be
 * unit-tested with a fake `Storage` implementation, and no helper touches
 * `window` at module scope (this module is imported by a client component).
 */

export interface CustomXdrPreset {
  id: string;
  label: string;
  value: string;
  createdAt: string;
}

export const CUSTOM_XDR_PRESETS_KEY = "devconsole.xdr.customPresets.v1";

/** Keeps the drawer usable and localStorage well under the 5 MB quota. */
export const MAX_CUSTOM_PRESETS = 50;
export const MAX_PRESET_LABEL_LENGTH = 60;
export const MAX_PRESET_VALUE_LENGTH = 8192;

export type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;

export interface PresetStoreResult {
  ok: boolean;
  error?: string;
  presets: CustomXdrPreset[];
}

/** `null` during SSR, in private mode, or when the browser blocks storage. */
export function getBrowserStorage(): StorageLike | null {
  if (typeof window === "undefined") return null;
  try {
    const storage = window.localStorage;
    if (!storage) return null;
    const probe = `${CUSTOM_XDR_PRESETS_KEY}.probe`;
    storage.setItem(probe, "1");
    storage.removeItem(probe);
    return storage;
  } catch {
    return null;
  }
}

function isPreset(value: unknown): value is CustomXdrPreset {
  if (!value || typeof value !== "object") return false;
  const preset = value as Partial<CustomXdrPreset>;
  return (
    typeof preset.id === "string" &&
    preset.id.length > 0 &&
    typeof preset.label === "string" &&
    preset.label.length > 0 &&
    typeof preset.value === "string" &&
    preset.value.length > 0 &&
    typeof preset.createdAt === "string"
  );
}

/** Tolerant read: malformed JSON or foreign entries degrade to an empty list. */
export function parseCustomPresets(raw: string | null | undefined): CustomXdrPreset[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isPreset).slice(0, MAX_CUSTOM_PRESETS);
  } catch {
    return [];
  }
}

export function serializeCustomPresets(presets: CustomXdrPreset[]): string {
  return JSON.stringify(presets.slice(0, MAX_CUSTOM_PRESETS));
}

export function loadCustomPresets(storage: StorageLike | null = getBrowserStorage()): CustomXdrPreset[] {
  if (!storage) return [];
  try {
    return parseCustomPresets(storage.getItem(CUSTOM_XDR_PRESETS_KEY));
  } catch {
    return [];
  }
}

function persist(storage: StorageLike, presets: CustomXdrPreset[]): string | null {
  try {
    storage.setItem(CUSTOM_XDR_PRESETS_KEY, serializeCustomPresets(presets));
    return null;
  } catch {
    return "Browser storage rejected the preset (quota exceeded or storage disabled).";
  }
}

export function createPresetId(label: string, now: number = Date.now()): string {
  const slug = label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 32);
  return `${slug || "preset"}-${now.toString(36)}`;
}

/**
 * Validate and append a preset. Returns the new list on success, or the
 * unchanged list plus a human-readable `error`.
 */
export function addCustomPreset(
  label: string,
  value: string,
  existing: CustomXdrPreset[],
  storage: StorageLike | null = getBrowserStorage(),
  now: number = Date.now(),
): PresetStoreResult {
  const cleanLabel = label.trim();
  const cleanValue = value.trim();

  if (!cleanLabel) return { ok: false, error: "Give the preset a label.", presets: existing };
  if (cleanLabel.length > MAX_PRESET_LABEL_LENGTH) {
    return { ok: false, error: `Labels are limited to ${MAX_PRESET_LABEL_LENGTH} characters.`, presets: existing };
  }
  if (!cleanValue) return { ok: false, error: "There is no XDR value to save.", presets: existing };
  if (cleanValue.length > MAX_PRESET_VALUE_LENGTH) {
    return { ok: false, error: "This XDR value is too long to store as a preset.", presets: existing };
  }
  if (existing.some((preset) => preset.label.toLowerCase() === cleanLabel.toLowerCase())) {
    return { ok: false, error: `A preset named “${cleanLabel}” already exists.`, presets: existing };
  }
  if (existing.length >= MAX_CUSTOM_PRESETS) {
    return { ok: false, error: `You can keep at most ${MAX_CUSTOM_PRESETS} presets — delete one first.`, presets: existing };
  }

  const preset: CustomXdrPreset = {
    id: createPresetId(cleanLabel, now),
    label: cleanLabel,
    value: cleanValue,
    createdAt: new Date(now).toISOString(),
  };
  const next = [preset, ...existing];

  if (!storage) {
    return { ok: false, error: "Browser storage is unavailable, so the preset was not saved.", presets: existing };
  }
  const failure = persist(storage, next);
  if (failure) return { ok: false, error: failure, presets: existing };
  return { ok: true, presets: next };
}

export function removeCustomPreset(
  id: string,
  existing: CustomXdrPreset[],
  storage: StorageLike | null = getBrowserStorage(),
): CustomXdrPreset[] {
  const next = existing.filter((preset) => preset.id !== id);
  if (next.length === existing.length) return existing;
  if (storage) {
    try {
      storage.setItem(CUSTOM_XDR_PRESETS_KEY, serializeCustomPresets(next));
    } catch {
      // Storage is full or disabled: fall back to the in-memory list.
    }
  }
  return next;
}
