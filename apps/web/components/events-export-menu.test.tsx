import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { EventsExportMenu } from "./events-export-menu";

const events = [
  { id: "1", ts: "2026-03-10T12:00:00Z", type: "a", topic: ["a"], data: "x", txHash: "h1", ledger: 1 },
  { id: "2", ts: "2026-03-12T12:00:00Z", type: "b", topic: ["b"], data: "y", txHash: "h2", ledger: 2 },
];

const readBlob = (blob: Blob) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsText(blob);
  });

describe("EventsExportMenu", () => {
  let blobs: Blob[];
  let downloadName = "";

  beforeEach(() => {
    blobs = [];
    URL.createObjectURL = vi.fn((b: Blob) => (blobs.push(b), "blob:test")) as never;
    URL.revokeObjectURL = vi.fn() as never;
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (this: HTMLAnchorElement) {
      downloadName = this.download;
    });
  });
  afterEach(() => vi.restoreAllMocks());

  it("opens a panel with every column selected", () => {
    render(<EventsExportMenu contractId="CABC" events={events} />);
    fireEvent.click(screen.getByRole("button", { name: /export csv/i }));
    expect(screen.getAllByRole("checkbox")).toHaveLength(5);
    screen.getAllByRole("checkbox").forEach((c) => expect(c).toBeChecked());
    expect(screen.getByText("2 of 2 events will be exported.")).toBeInTheDocument();
  });

  it("downloads {contractId}-events-{date}.csv with the chosen columns", async () => {
    render(<EventsExportMenu contractId="CABC" events={events} />);
    fireEvent.click(screen.getByRole("button", { name: /export csv/i }));
    fireEvent.click(screen.getByLabelText("Data"));
    fireEvent.click(screen.getByLabelText("Topic"));
    fireEvent.click(screen.getByRole("button", { name: "Download" }));
    expect(downloadName).toMatch(/^CABC-events-\d{4}-\d{2}-\d{2}\.csv$/);
    const text = await readBlob(blobs[0]);
    expect(text.split("\r\n")[0]).toBe("timestamp,transaction_hash,ledger_sequence");
  });

  it("applies the date range before export", async () => {
    render(<EventsExportMenu contractId="CABC" events={events} />);
    fireEvent.click(screen.getByRole("button", { name: /export csv/i }));
    fireEvent.change(screen.getByLabelText("From"), { target: { value: "2026-03-11" } });
    expect(screen.getByText("1 of 2 events will be exported.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Download" }));
    const text = await readBlob(blobs[0]);
    expect(text).toContain("h2");
    expect(text).not.toContain("h1");
  });

  it("disables download for an inverted range or no columns", () => {
    render(<EventsExportMenu contractId="CABC" events={events} />);
    fireEvent.click(screen.getByRole("button", { name: /export csv/i }));
    fireEvent.change(screen.getByLabelText("From"), { target: { value: "2026-03-12" } });
    fireEvent.change(screen.getByLabelText("To"), { target: { value: "2026-03-10" } });
    expect(screen.getByRole("button", { name: "Download" })).toBeDisabled();
    fireEvent.change(screen.getByLabelText("To"), { target: { value: "" } });
    expect(screen.getByRole("button", { name: "Download" })).toBeEnabled();
    screen.getAllByRole("checkbox").forEach((c) => fireEvent.click(c));
    expect(screen.getByRole("button", { name: "Download" })).toBeDisabled();
  });
});
