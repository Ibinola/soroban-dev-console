import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { TerminalOutputViewer } from "./terminal-output-viewer";
import type { TerminalSection } from "@/lib/simulation-terminal";

const sections: TerminalSection[] = [
  { id: "auth", title: "auth", lines: [{ level: "info", text: "require_auth CABC" }] },
  { id: "result", title: "result", lines: [{ level: "error", text: "Error: boom" }] },
];

// jsdom has no PointerEvent; MouseEvent carries the clientY the handlers read.
if (typeof window.PointerEvent === "undefined") {
  (window as unknown as { PointerEvent: typeof MouseEvent }).PointerEvent = MouseEvent;
}

describe("TerminalOutputViewer", () => {
  it("colours log levels", () => {
    render(<TerminalOutputViewer sections={sections} />);
    expect(screen.getByText("INFO")).toHaveClass("text-emerald-400");
    expect(screen.getByText("ERROR")).toHaveClass("text-red-400");
  });

  it("collapses and expands a section", () => {
    render(<TerminalOutputViewer sections={sections} />);
    const toggle = screen.getByRole("button", { name: /\[auth\]/ });
    fireEvent.click(toggle);
    expect(screen.queryByText("require_auth CABC")).not.toBeInTheDocument();
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(toggle);
    expect(screen.getByText("require_auth CABC")).toBeInTheDocument();
  });

  it("copies the full output as text", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });
    render(<TerminalOutputViewer sections={sections} />);
    fireEvent.click(screen.getByRole("button", { name: /copy output/i }));
    expect(writeText).toHaveBeenCalledTimes(1);
    expect(writeText.mock.calls[0][0]).toContain("[auth]");
    expect(writeText.mock.calls[0][0]).toContain("ERROR Error: boom");
  });

  it("is resizable via the drag handle", () => {
    render(<TerminalOutputViewer sections={sections} />);
    const body = screen.getByTestId("terminal-body");
    const handle = screen.getByRole("separator", { name: /resize terminal/i });
    Object.assign(handle, { setPointerCapture: () => {} });
    fireEvent.pointerDown(handle, { clientY: 100, pointerId: 1 });
    fireEvent.pointerMove(handle, { clientY: 160, pointerId: 1 });
    expect(body.style.height).toBe("284px");
    fireEvent.pointerMove(handle, { clientY: -500, pointerId: 1 });
    expect(body.style.height).toBe("96px");
  });
});
