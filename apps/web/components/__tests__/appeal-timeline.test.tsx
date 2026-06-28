import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";

interface TimelineEvent {
  id: string;
  label: string;
  timestamp: string;
  status: "pending" | "done" | "failed";
}

function AppealTimeline({ events }: { events: TimelineEvent[] }) {
  const sorted = [...events].sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  return (
    <ol>
      {sorted.map((e) => (
        <li key={e.id} data-testid={`event-${e.id}`} data-status={e.status}>
          {e.label}
        </li>
      ))}
    </ol>
  );
}

describe("AppealTimeline", () => {
  const events: TimelineEvent[] = [
    { id: "1", label: "Submitted", timestamp: "2025-01-01T10:00:00Z", status: "done" },
    { id: "2", label: "Under Review", timestamp: "2025-01-02T10:00:00Z", status: "done" },
    { id: "3", label: "Decision Pending", timestamp: "2025-01-03T10:00:00Z", status: "pending" },
  ];

  it("renders all timeline events", () => {
    render(<AppealTimeline events={events} />);
    expect(screen.getAllByRole("listitem")).toHaveLength(3);
  });

  it("renders events in chronological order regardless of input order", () => {
    render(<AppealTimeline events={[...events].reverse()} />);
    const items = screen.getAllByRole("listitem");
    expect(items[0]).toHaveTextContent("Submitted");
    expect(items[2]).toHaveTextContent("Decision Pending");
  });
});
