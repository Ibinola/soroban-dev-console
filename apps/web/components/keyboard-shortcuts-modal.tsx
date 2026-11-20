"use client";

/**
 * KeyboardShortcutsModal
 *
 * Issue #954: Keyboard shortcuts helper modal (Shift+?) displaying global keybindings.
 *
 * Changes / additions:
 *  - Registers BOTH `?` (plain) AND `Shift+?` as trigger keybindings so the
 *    modal opens reliably across keyboard layouts where `?` requires Shift.
 *  - Full keyboard navigation inside the modal: Tab / Shift+Tab cycle through
 *    shortcut rows; arrow keys Up/Down move between rows; Escape closes.
 *  - Accessible: each row has `role="row"`, the table has `role="table"`,
 *    and focus is trapped inside the dialog while it is open.
 *  - Active-group tab bar lets users filter shortcuts by category using
 *    keyboard (← → arrows on the tab list).
 */

import { useEffect, useCallback, useRef, useState } from "react";
import { Keyboard } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
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
 * Issue #954: Keyboard shortcut help modal — Shift+? trigger + keyboard nav.
 */
export const KEYBOARD_SHORTCUTS: ShortcutEntry[] = [
  // Global
  { keys: ["Shift", "?"], description: "Open keyboard shortcuts help", group: "Global" },
  { keys: ["⌘", "K"],     description: "Open command palette",         group: "Global" },
  { keys: ["Escape"],     description: "Close modal / dismiss dialog",  group: "Global" },

  // Contract Explorer
  { keys: ["⌘", "F"],         description: "Search contracts",       group: "Contract Explorer" },
  { keys: ["⌘", "Enter"],     description: "Run simulation",         group: "Contract Explorer" },
  { keys: ["⌘", "⇧", "C"],   description: "Copy contract address",  group: "Contract Explorer" },

  // Workspace
  { keys: ["⌘", "⇧", "N"], description: "New workspace",             group: "Workspace" },
  { keys: ["⌘", "⇧", "S"], description: "Sync workspace to cloud",   group: "Workspace" },
  { keys: ["⌘", "⇧", "E"], description: "Export workspace",          group: "Workspace" },

  // Transaction
  { keys: ["⌘", "⇧", "T"], description: "New transaction lookup", group: "Transaction" },
  { keys: ["⌘", "⇧", "X"], description: "Decode XDR",             group: "Transaction" },
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

// ── Constants ─────────────────────────────────────────────────────────────────

const GROUPS = ["All", "Global", "Contract Explorer", "Workspace", "Transaction"] as const;
type Group = (typeof GROUPS)[number];

// ── Sub-components ────────────────────────────────────────────────────────────

function KeyBadge({ keyName }: { keyName: string }) {
  return (
    <kbd className="inline-flex h-6 min-w-6 items-center justify-center rounded border border-border bg-muted px-1.5 text-xs font-mono text-muted-foreground shadow-sm">
      {keyName}
    </kbd>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function KeyboardShortcutsModal() {
  const { isOpen, close, toggle } = useKeyboardShortcutsStore();
  const [activeGroup, setActiveGroup] = useState<Group>("All");
  const tabListRef = useRef<HTMLDivElement>(null);
  const rowsRef = useRef<HTMLDivElement>(null);

  // ── Global keybinding: ? or Shift+? ────────────────────────────────────────
  const handleGlobalKeyDown = useCallback(
    (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      const isInputFocused =
        tag === "INPUT" ||
        tag === "TEXTAREA" ||
        tag === "SELECT" ||
        (e.target as HTMLElement).isContentEditable;

      // Open on bare `?` or `Shift+?` (handles layouts where ? requires Shift)
      const isShortcutKey =
        (e.key === "?" || (e.shiftKey && e.key === "/")) &&
        !isInputFocused &&
        !e.ctrlKey &&
        !e.metaKey;

      if (isShortcutKey) {
        e.preventDefault();
        toggle();
      }
    },
    [toggle],
  );

  useEffect(() => {
    document.addEventListener("keydown", handleGlobalKeyDown);
    return () => document.removeEventListener("keydown", handleGlobalKeyDown);
  }, [handleGlobalKeyDown]);

  // Reset active group when dialog closes
  useEffect(() => {
    if (!isOpen) setActiveGroup("All");
  }, [isOpen]);

  // ── Keyboard navigation inside the tab bar ──────────────────────────────────
  const handleTabKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLButtonElement>, index: number) => {
      const tabs = tabListRef.current?.querySelectorAll<HTMLButtonElement>("button[role='tab']");
      if (!tabs) return;

      if (e.key === "ArrowRight") {
        e.preventDefault();
        const next = (index + 1) % tabs.length;
        tabs[next]?.focus();
        setActiveGroup(GROUPS[next]);
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        const prev = (index - 1 + tabs.length) % tabs.length;
        tabs[prev]?.focus();
        setActiveGroup(GROUPS[prev]);
      }
    },
    [],
  );

  // ── Keyboard navigation inside the shortcut rows ────────────────────────────
  const handleRowKeyDown = useCallback((e: React.KeyboardEvent<HTMLDivElement>) => {
    const rows = rowsRef.current?.querySelectorAll<HTMLDivElement>("[role='row']");
    if (!rows) return;

    const current = document.activeElement as HTMLElement;
    const currentIndex = Array.from(rows).indexOf(current as HTMLDivElement);

    if (e.key === "ArrowDown") {
      e.preventDefault();
      const next = rows[currentIndex + 1] ?? rows[0];
      (next as HTMLElement)?.focus();
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      const prev = rows[currentIndex - 1] ?? rows[rows.length - 1];
      (prev as HTMLElement)?.focus();
    }
  }, []);

  // ── Filtered shortcuts ──────────────────────────────────────────────────────
  const visible =
    activeGroup === "All"
      ? KEYBOARD_SHORTCUTS
      : KEYBOARD_SHORTCUTS.filter((s) => s.group === activeGroup);

  const grouped = GROUPS.slice(1).reduce<Record<string, ShortcutEntry[]>>((acc, g) => {
    const entries = visible.filter((s) => s.group === g);
    if (entries.length) acc[g] = entries;
    return acc;
  }, {});

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && close()}>
      <DialogContent
        className="max-h-[80vh] max-w-2xl overflow-y-auto"
        aria-label="Keyboard shortcuts"
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Keyboard className="h-5 w-5" aria-hidden="true" />
            Keyboard Shortcuts
          </DialogTitle>
        </DialogHeader>

        {/* ── Group tab bar ─────────────────────────────────────────────────── */}
        <div
          ref={tabListRef}
          role="tablist"
          aria-label="Filter shortcuts by category"
          className="mt-3 flex flex-wrap gap-1"
        >
          {GROUPS.map((group, index) => (
            <button
              key={group}
              role="tab"
              aria-selected={activeGroup === group}
              tabIndex={activeGroup === group ? 0 : -1}
              onClick={() => setActiveGroup(group)}
              onKeyDown={(e) => handleTabKeyDown(e, index)}
              className={[
                "rounded-full border px-3 py-1 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                activeGroup === group
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-transparent text-muted-foreground hover:bg-muted",
              ].join(" ")}
            >
              {group}
            </button>
          ))}
        </div>

        {/* ── Shortcut rows ──────────────────────────────────────────────────── */}
        <div
          ref={rowsRef}
          role="table"
          aria-label="Keyboard shortcuts list"
          className="mt-4 space-y-5"
          onKeyDown={handleRowKeyDown}
        >
          {Object.entries(grouped).map(([group, shortcuts]) => (
            <div key={group} role="rowgroup">
              <h3
                className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground"
                id={`shortcuts-group-${group.replace(/\s+/g, "-").toLowerCase()}`}
              >
                {group}
              </h3>
              <div className="divide-y divide-border rounded-md border">
                {shortcuts.map((shortcut, idx) => (
                  <div
                    key={idx}
                    role="row"
                    tabIndex={0}
                    aria-labelledby={`shortcuts-group-${group.replace(/\s+/g, "-").toLowerCase()}`}
                    className="flex items-center justify-between px-4 py-2.5 text-sm focus-visible:bg-muted focus-visible:outline-none"
                  >
                    <span className="text-foreground">{shortcut.description}</span>
                    <div className="flex items-center gap-1" aria-label={`Keys: ${shortcut.keys.join(" + ")}`}>
                      {shortcut.keys.map((k, i) => (
                        <KeyBadge key={i} keyName={k} />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <p className="mt-4 text-center text-xs text-muted-foreground">
          Press{" "}
          <kbd className="mx-0.5 inline-flex h-5 min-w-5 items-center justify-center rounded border border-border bg-muted px-1 text-[10px] font-mono">
            Shift
          </kbd>
          +
          <kbd className="mx-0.5 inline-flex h-5 min-w-5 items-center justify-center rounded border border-border bg-muted px-1 text-[10px] font-mono">
            ?
          </kbd>{" "}
          to toggle this panel · Use{" "}
          <kbd className="mx-0.5 inline-flex h-5 min-w-5 items-center justify-center rounded border border-border bg-muted px-1 text-[10px] font-mono">
            ↑↓
          </kbd>{" "}
          to navigate rows
        </p>
      </DialogContent>
    </Dialog>
  );
}
