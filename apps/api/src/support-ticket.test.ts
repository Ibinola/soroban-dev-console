import { describe, it, expect } from "vitest";

type TicketStatus = "open" | "in-review" | "resolved" | "closed";

interface SupportTicket {
  id: string;
  subject: string;
  status: TicketStatus;
  createdAt: string;
}

function createTicket(subject: string): SupportTicket {
  return { id: `ticket-${Date.now()}`, subject, status: "open", createdAt: new Date().toISOString() };
}

function advanceTicket(ticket: SupportTicket, next: TicketStatus): SupportTicket {
  return { ...ticket, status: next };
}

describe("support ticket workflow", () => {
  it("creates a ticket with open status", () => {
    const t = createTicket("Contract invocation failed");
    expect(t.status).toBe("open");
    expect(t.subject).toBeTruthy();
    expect(t.id).toMatch(/^ticket-/);
  });

  it("advances ticket through the full workflow", () => {
    let t = createTicket("Test issue");
    t = advanceTicket(t, "in-review");
    expect(t.status).toBe("in-review");
    t = advanceTicket(t, "resolved");
    expect(t.status).toBe("resolved");
    t = advanceTicket(t, "closed");
    expect(t.status).toBe("closed");
  });

  it("two tickets created in sequence have different IDs", async () => {
    const t1 = createTicket("A");
    await new Promise((r) => setTimeout(r, 2));
    const t2 = createTicket("B");
    expect(t1.id).not.toBe(t2.id);
  });
});
