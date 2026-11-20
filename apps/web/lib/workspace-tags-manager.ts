/**
 * Visual tag color definitions and custom badge label manager for workspace items.
 */

export interface WorkspaceTag {
  id: string;
  label: string;
  colorHex: string;
}

export const PRESET_TAG_COLORS = [
  '#3b82f6', // blue
  '#10b981', // green
  '#f59e0b', // amber
  '#ef4444', // red
  '#8b5cf6', // purple
];

export function createTag(label: string, colorHex?: string): WorkspaceTag {
  return {
    id: `tag_${Math.random().toString(36).substring(2, 7)}`,
    label: label.trim(),
    colorHex: colorHex || PRESET_TAG_COLORS[0],
  };
}
