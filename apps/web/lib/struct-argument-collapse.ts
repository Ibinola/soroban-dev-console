/**
 * Helper for managing expand/collapse accordion states for nested ScVal struct arguments.
 */

export interface StructCollapseState {
  collapsedFields: Set<string>;
}

export function toggleFieldCollapseState(state: StructCollapseState, fieldPath: string): StructCollapseState {
  const nextSet = new Set(state.collapsedFields);
  if (nextSet.has(fieldPath)) {
    nextSet.delete(fieldPath);
  } else {
    nextSet.add(fieldPath);
  }
  return { collapsedFields: nextSet };
}

export function collapseAllStructFields(allFieldPaths: string[]): StructCollapseState {
  return { collapsedFields: new Set(allFieldPaths) };
}

export function expandAllStructFields(): StructCollapseState {
  return { collapsedFields: new Set() };
}
