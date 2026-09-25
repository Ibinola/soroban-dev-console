/**
 * Issue #1106: filter predicate for the XDR presets drawer's search bar.
 * Pure so it's directly unit-testable and shared between the built-in
 * samples (label + description) and user-saved presets (label only).
 */

export interface SearchablePreset {
  label: string;
  description?: string;
}

/** Case-insensitive substring match against a preset's label and (if present) description. */
export function matchesPresetSearch<T extends SearchablePreset>(
  preset: T,
  query: string,
): boolean {
  const trimmed = query.trim().toLowerCase();
  if (!trimmed) return true;
  const haystack = `${preset.label} ${preset.description ?? ""}`.toLowerCase();
  return haystack.includes(trimmed);
}

export function filterPresets<T extends SearchablePreset>(presets: T[], query: string): T[] {
  return presets.filter((p) => matchesPresetSearch(p, query));
}
