import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { StorageChart } from "./storage-chart";

const entries = [
  { id: "a", keyValue: "Balance", decodedValue: "100", found: true },
  { id: "b", keyValue: "Supply", decodedValue: "300", found: true },
  { id: "c", keyValue: "Name", decodedValue: "Token", found: true },
];

describe("StorageChart", () => {
  it("charts numeric values as bars by default and excludes text values", () => {
    render(<StorageChart entries={entries} history={{}} />);
    expect(screen.getByRole("img", { name: /bar chart/i })).toBeInTheDocument();
    expect(screen.getByText("2 numeric values")).toBeInTheDocument();
    expect(screen.queryByText("Name")).not.toBeInTheDocument();
  });

  it("switches chart type from the dropdown", () => {
    render(<StorageChart entries={entries} history={{}} />);
    fireEvent.change(screen.getByLabelText("Chart type"), { target: { value: "pie" } });
    expect(screen.getByRole("img", { name: /pie chart/i })).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Chart type"), { target: { value: "line" } });
    expect(screen.getByText(/refresh storage at least twice/i)).toBeInTheDocument();
  });

  it("draws a line once history is available", () => {
    render(
      <StorageChart
        entries={entries}
        history={{ a: [{ t: 1, v: 10 }, { t: 2, v: 20 }] }}
      />,
    );
    fireEvent.change(screen.getByLabelText("Chart type"), { target: { value: "line" } });
    expect(screen.getByRole("img", { name: /line chart/i })).toBeInTheDocument();
  });

  it("explains when there is nothing numeric to chart", () => {
    render(<StorageChart entries={[{ id: "x", keyValue: "k", decodedValue: "text", found: true }]} history={{}} />);
    expect(screen.getByText(/no numeric storage values/i)).toBeInTheDocument();
  });
});
