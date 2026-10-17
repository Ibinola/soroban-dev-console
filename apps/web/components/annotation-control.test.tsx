import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { AnnotationControl } from "./annotation-control";
import { useWorkspaceNotesStore } from "@/store/useWorkspaceNotesStore";
import { useWorkspaceStore } from "@/store/useWorkspaceStore";

const noteFor = (type: string, id: string) =>
  useWorkspaceNotesStore.getState().notes.filter((n) => n.resourceType === type && n.resourceId === id);

describe("AnnotationControl (#1291)", () => {
  beforeEach(() => {
    useWorkspaceNotesStore.setState({ notes: [] });
  });

  it("adds a note to an event", () => {
    render(<AnnotationControl resourceType="event" resourceId="evt-1" />);
    fireEvent.click(screen.getByRole("button", { name: /add note/i }));
    fireEvent.change(screen.getByLabelText("Note"), { target: { value: "suspicious transfer" } });
    fireEvent.click(screen.getByRole("button", { name: "Save note" }));

    expect(screen.getByText("suspicious transfer")).toBeInTheDocument();
    const [stored] = noteFor("event", "evt-1");
    expect(stored.body).toBe("suspicious transfer");
    expect(stored.workspaceId).toBe(useWorkspaceStore.getState().activeWorkspaceId);
  });

  it("shows the full note as the badge tooltip", () => {
    render(<AnnotationControl resourceType="transaction" resourceId="tx-1" />);
    fireEvent.click(screen.getByRole("button", { name: /add note/i }));
    fireEvent.change(screen.getByLabelText("Note"), { target: { value: "ran during the incident" } });
    fireEvent.keyDown(screen.getByLabelText("Note"), { key: "Enter" });
    expect(screen.getByTitle("ran during the incident")).toBeInTheDocument();
  });

  it("edits and deletes an existing note", () => {
    render(<AnnotationControl resourceType="event" resourceId="evt-2" />);
    fireEvent.click(screen.getByRole("button", { name: /add note/i }));
    fireEvent.change(screen.getByLabelText("Note"), { target: { value: "first" } });
    fireEvent.click(screen.getByRole("button", { name: "Save note" }));

    fireEvent.click(screen.getByRole("button", { name: "Edit note" }));
    expect(screen.getByLabelText("Note")).toHaveValue("first");
    fireEvent.change(screen.getByLabelText("Note"), { target: { value: "second" } });
    fireEvent.click(screen.getByRole("button", { name: "Save note" }));
    expect(noteFor("event", "evt-2")).toHaveLength(1);
    expect(noteFor("event", "evt-2")[0].body).toBe("second");

    fireEvent.click(screen.getByRole("button", { name: "Delete note" }));
    expect(noteFor("event", "evt-2")).toHaveLength(0);
    expect(screen.getByRole("button", { name: /add note/i })).toBeInTheDocument();
  });

  it("rejects empty and over-long notes", () => {
    render(<AnnotationControl resourceType="event" resourceId="evt-3" />);
    fireEvent.click(screen.getByRole("button", { name: /add note/i }));
    fireEvent.click(screen.getByRole("button", { name: "Save note" }));
    expect(screen.getByRole("alert")).toHaveTextContent(/empty/i);

    fireEvent.change(screen.getByLabelText("Note"), { target: { value: "x".repeat(201) } });
    fireEvent.click(screen.getByRole("button", { name: "Save note" }));
    expect(screen.getByRole("alert")).toHaveTextContent("200");
    expect(noteFor("event", "evt-3")).toHaveLength(0);
  });

  it("keeps notes for different items separate", () => {
    useWorkspaceNotesStore.getState().addNote(useWorkspaceStore.getState().activeWorkspaceId, "other", {
      resourceType: "event",
      resourceId: "evt-other",
    });
    render(<AnnotationControl resourceType="event" resourceId="evt-4" />);
    expect(screen.getByRole("button", { name: /add note/i })).toBeInTheDocument();
    expect(screen.queryByText("other")).not.toBeInTheDocument();
  });

  it("cancels editing without saving", () => {
    render(<AnnotationControl resourceType="event" resourceId="evt-5" />);
    fireEvent.click(screen.getByRole("button", { name: /add note/i }));
    fireEvent.change(screen.getByLabelText("Note"), { target: { value: "draft" } });
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(noteFor("event", "evt-5")).toHaveLength(0);
  });
});
