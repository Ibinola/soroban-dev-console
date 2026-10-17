"use client";

import { useState } from "react";
import { Check, MessageSquarePlus, Pencil, Trash2, X } from "lucide-react";
import { Button } from "@devconsole/ui";
import { Badge } from "@devconsole/ui";
import { useWorkspaceNotesStore } from "@/store/useWorkspaceNotesStore";
import { useWorkspaceStore } from "@/store/useWorkspaceStore";
import type { WorkspaceNote } from "@/store/workspace-schema";
import { MAX_ANNOTATION_LENGTH, validateAnnotation } from "@/lib/annotations";

type AnnotatableType = Extract<NonNullable<WorkspaceNote["resourceType"]>, "event" | "transaction">;

/**
 * "Add note" control for one event or transaction result. The note lives in
 * the workspace notes store (so it persists and travels with exports) and is
 * shown as a badge with the full text in its tooltip.
 */
export function AnnotationControl({
  resourceType,
  resourceId,
}: {
  resourceType: AnnotatableType;
  resourceId: string;
}) {
  const workspaceId = useWorkspaceStore((s) => s.activeWorkspaceId);
  const note = useWorkspaceNotesStore((s) =>
    s.notes.find(
      (n) => n.workspaceId === workspaceId && n.resourceType === resourceType && n.resourceId === resourceId,
    ),
  );
  const { addNote, updateNote, deleteNote } = useWorkspaceNotesStore();

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);

  const startEditing = () => {
    setDraft(note?.body ?? "");
    setError(null);
    setEditing(true);
  };

  const save = () => {
    const result = validateAnnotation(draft);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    if (note) updateNote(note.id, result.value);
    else addNote(workspaceId, result.value, { resourceType, resourceId });
    setEditing(false);
  };

  if (editing) {
    return (
      <div className="flex flex-col gap-1" role="group" aria-label="Edit note">
        <div className="flex items-center gap-1">
          <input
            autoFocus
            aria-label="Note"
            className="h-7 min-w-0 flex-1 rounded-md border bg-background px-2 text-xs"
            value={draft}
            maxLength={MAX_ANNOTATION_LENGTH + 50}
            onChange={(e) => {
              setDraft(e.target.value);
              setError(null);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") save();
              if (e.key === "Escape") setEditing(false);
            }}
          />
          <Button size="icon" variant="ghost" className="h-7 w-7" aria-label="Save note" onClick={save}>
            <Check className="h-3 w-3" />
          </Button>
          <Button size="icon" variant="ghost" className="h-7 w-7" aria-label="Cancel" onClick={() => setEditing(false)}>
            <X className="h-3 w-3" />
          </Button>
        </div>
        <div className="flex justify-between text-[10px]">
          <span className="text-destructive" role={error ? "alert" : undefined}>
            {error}
          </span>
          <span className="text-muted-foreground">
            {draft.length}/{MAX_ANNOTATION_LENGTH}
          </span>
        </div>
      </div>
    );
  }

  if (!note) {
    return (
      <Button size="sm" variant="ghost" className="h-6 gap-1 px-1 text-[11px]" onClick={startEditing}>
        <MessageSquarePlus className="h-3 w-3" />
        Add note
      </Button>
    );
  }

  return (
    <span className="inline-flex items-center gap-1">
      <Badge variant="secondary" className="max-w-[180px] truncate text-[11px]" title={note.body}>
        {note.body}
      </Badge>
      <Button size="icon" variant="ghost" className="h-6 w-6" aria-label="Edit note" onClick={startEditing}>
        <Pencil className="h-3 w-3" />
      </Button>
      <Button size="icon" variant="ghost" className="h-6 w-6" aria-label="Delete note" onClick={() => deleteNote(note.id)}>
        <Trash2 className="h-3 w-3" />
      </Button>
    </span>
  );
}
