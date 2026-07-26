"use client";

import { useEffect, useCallback } from "react";
import { Keyboard, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogClose,
} from "@devconsole/ui";
import { create } from "zustand";

// ── Shortcut registry ─────────────────────────────────────────────────────────

export interface ShortcutEntry {
  keys: string[];
  description: string;
  group: "Global" | "Contract Explorer" | "Workspace" | "Transaction";
}

/**
 * Central registry of all keyboard shortcuts in the app.
 * Update this list when adding new shortcuts so the modal stays in sync.
 *
 * Issue #750: Keyboard shortcut help modal.
 */
export const KEYBOARD_SHORTCUTS: ShortcutEntry[] = [
  // Global
  { keys: ["?"], description: "Open keyboard shortcuts help", group: "Global" },
  { keys: ["⌘", "K"], description: "Open command palette", group: "Global" },
  { keys: ["Escape"], description: "Close modal / dismiss dialog", group: "Global" },

  // Contract Explorer
  { keys: ["⌘", "F"], description: "Search contracts", group: "Contract Explorer" },
  { keys: ["⌘", "Enter"], description: "Run simulation", group: "Contract Explorer" },
  { keys: ["⌘", "⇧", "C"], description: "Copy contract address", group: "Contract Explorer" },

  // Workspace
  { keys: ["⌘", "⇧", "N"], description: "New workspace", group: "Workspace" },
  { keys: ["⌘", "⇧", "S"], description: "Sync workspace to cloud", group: "Workspace" },
  { keys: ["⌘", "⇧", "E"], description: "Export workspace", group: "Workspace" },

  // Transaction
  { keys: ["⌘", "⇧", "T"], description: "New transaction lookup", group: "Transaction" },
  { keys: ["⌘", "⇧", "X"], description: "Decode XDR", group: "Transaction" },
];

// ── Modal state ───────────────────────────────────────────────────────────────

interface ShortcutsModalState {
  isOpen: boolean;
  open: () => void;
  close: () => void;
  toggle: () => void;
}

export const useKeyboardShortcutsStore = create<ShortcutsModalState>((set) => ({
  isOpen: false,
  open: () => set({ isOpen: true }),
  close: () => set({ isOpen: false }),
  toggle: () => set((s) => ({ isOpen: !s.isOpen })),
}));

// ── Component ─────────────────────────────────────────────────────────────────

const GROUPS = ["Global", "Contract Explorer", "Workspace", "Transaction"] as const;

function KeyBadge({ key: k }: { key: string }) {
  return (
    <kbd className="inline-flex h-6 min-w-6 items-center justify-center rounded border border-border bg-muted px-1.5 text-xs font-mono text-muted-foreground shadow-sm">
      {k}
    </kbd>
  );
}

export function KeyboardShortcutsModal() {
  const { isOpen, close, toggle } = useKeyboardShortcutsStore();

  // Issue #750: Triggered by pressing ? when no input is focused
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      const isInputFocused =
        tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" ||
        (e.target as HTMLElement).isContentEditable;

      if (e.key === "?" && !isInputFocused && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        toggle();
      }
    },
    [toggle],
  );

  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && close()}>
      <DialogContent
        className="max-h-[80vh] max-w-2xl overflow-y-auto"
        aria-label="Keyboard shortcuts"
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Keyboard className="h-5 w-5" />
            Keyboard Shortcuts
          </DialogTitle>
        </DialogHeader>

        <div className="mt-2 space-y-6">
          {GROUPS.map((group) => {
            const shortcuts = KEYBOARD_SHORTCUTS.filter((s) => s.group === group);
            if (shortcuts.length === 0) return null;

            return (
              <div key={group}>
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {group}
                </h3>
                <div className="divide-y divide-border rounded-md border">
                  {shortcuts.map((shortcut, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between px-4 py-2.5 text-sm"
                    >
                      <span className="text-foreground">{shortcut.description}</span>
                      <div className="flex items-center gap-1">
                        {shortcut.keys.map((k, i) => (
                          <KeyBadge key={i} key={k} />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        <p className="mt-4 text-center text-xs text-muted-foreground">
          Press <kbd className="mx-0.5 inline-flex h-5 min-w-5 items-center justify-center rounded border border-border bg-muted px-1 text-[10px] font-mono">?</kbd> to toggle this panel
        </p>
      </DialogContent>
    </Dialog>
  );
}
