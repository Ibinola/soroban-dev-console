/**
 * Helper functions and ARIA accessibility tools for XDR Inspection components.
 */

export interface FocusTrapOptions {
  containerId: string;
  onEscape?: () => void;
}

export function createXdrFocusTrap(options: FocusTrapOptions): () => void {
  const container = document.getElementById(options.containerId);
  if (!container) return () => {};

  const focusableElements = container.querySelectorAll<HTMLElement>(
    'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
  );

  const firstElement = focusableElements[0];
  const lastElement = focusableElements[focusableElements.length - 1];

  const handleKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'Escape' && options.onEscape) {
      options.onEscape();
      return;
    }

    if (event.key !== 'Tab') return;

    if (event.shiftKey) {
      if (document.activeElement === firstElement) {
        lastElement?.focus();
        event.preventDefault();
      }
    } else {
      if (document.activeElement === lastElement) {
        firstElement?.focus();
        event.preventDefault();
      }
    }
  };

  container.addEventListener('keydown', handleKeyDown);
  firstElement?.focus();

  return () => {
    container.removeEventListener('keydown', handleKeyDown);
  };
}

export function getAriaAttributesForXdrNode(type: string, depth: number) {
  return {
    'role': 'treeitem',
    'aria-level': depth,
    'aria-label': `XDR Data Node ${type} at depth ${depth}`,
    'tabIndex': 0,
  };
}
