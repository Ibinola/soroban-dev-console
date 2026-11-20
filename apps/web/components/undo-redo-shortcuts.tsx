"use client";

/**
 * Issue #1269: Ctrl+Z / Ctrl+Y (and Cmd on macOS) shortcuts for the workspace
 * contract list, wired to the snapshot undo/redo stack in `useContractStore`.
 *
 * Rendered once from the contracts page. Keystrokes inside form fields are
 * ignored so native text editing keeps working.
 */

import { useEffect } from "react";
import { toast } from "sonner";
import { useContractStore } from "@/store/useContractStore";

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;

  return (
    target.isContentEditable ||
    ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)
  );
}

export function UndoRedoShortcuts() {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!(event.metaKey || event.ctrlKey) || event.altKey) return;
      if (event.key.toLowerCase() !== "z" && event.key.toLowerCase() !== "y")
        return;
      if (isEditableTarget(event.target)) return;

      // Ctrl+Y always redoes; Ctrl+Shift+Z is the macOS-friendly redo.
      const wantsRedo =
        event.key.toLowerCase() === "y" ||
        (event.key.toLowerCase() === "z" && event.shiftKey);

      const { undo, redo } = useContractStore.getState();
      const label = wantsRedo ? redo() : undo();
      if (!label) return;

      event.preventDefault();
      toast.success(`${wantsRedo ? "Redone" : "Undone"}: ${label}`);
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  return null;
}
