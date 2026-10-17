import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ContractPlayground } from "./contract-playground";
import { useAbiStore } from "@/store/useAbiStore";

const spec = {
  source: "json" as const,
  rawSpec: "",
  ingestedAt: 1,
  functions: [
    { name: "ping", inputs: [], outputs: [] },
    { name: "add", inputs: [{ name: "n", type: "u32" as const, required: true }], outputs: [] },
  ],
};

const flush = async () => {
  await act(async () => {
    await Promise.resolve();
  });
};

describe("ContractPlayground (#1290)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    useAbiStore.getState().setSpec("C1", spec);
  });
  afterEach(() => vi.useRealTimers());

  it("asks for an interface when none is loaded", () => {
    render(<ContractPlayground contractId="C-none" />);
    expect(screen.getByText(/load the contract interface/i)).toBeInTheDocument();
  });

  it("simulates 500 ms after a parameter change and shows the result and cost", async () => {
    const simulate = vi.fn().mockResolvedValue({
      ok: true,
      returnValue: "42",
      cost: { minResourceFee: "100", cpuInsns: 5, memBytes: 6 },
    });
    render(<ContractPlayground contractId="C1" simulate={simulate} />);

    fireEvent.change(screen.getByLabelText("Function"), { target: { value: "add" } });
    fireEvent.change(screen.getByLabelText(/^n/), { target: { value: "4" } });
    act(() => vi.advanceTimersByTime(499));
    expect(simulate).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(1));
    await flush();

    expect(simulate).toHaveBeenCalledTimes(1);
    expect(simulate.mock.calls[0][0].fnName).toBe("add");
    expect(screen.getByTestId("playground-result")).toHaveTextContent("42");
    expect(screen.getByLabelText("Resource cost estimate")).toHaveTextContent("100");
  });

  it("only simulates the latest value after rapid edits", async () => {
    const simulate = vi.fn().mockResolvedValue({ ok: true, returnValue: "ok" });
    render(<ContractPlayground contractId="C1" simulate={simulate} />);
    fireEvent.change(screen.getByLabelText("Function"), { target: { value: "add" } });
    const input = screen.getByLabelText(/^n/);
    for (const v of ["1", "12", "123"]) {
      fireEvent.change(input, { target: { value: v } });
      act(() => vi.advanceTimersByTime(200));
    }
    act(() => vi.advanceTimersByTime(500));
    await flush();
    expect(simulate).toHaveBeenCalledTimes(1);
  });

  it("runs immediately for functions without parameters", async () => {
    const simulate = vi.fn().mockResolvedValue({ ok: true, returnValue: "pong" });
    render(<ContractPlayground contractId="C1" simulate={simulate} />);
    fireEvent.change(screen.getByLabelText("Function"), { target: { value: "ping" } });
    act(() => vi.advanceTimersByTime(500));
    await flush();
    expect(screen.getByTestId("playground-result")).toHaveTextContent("pong");
  });

  it("does not simulate while required parameters are missing", async () => {
    const simulate = vi.fn();
    render(<ContractPlayground contractId="C1" simulate={simulate} />);
    fireEvent.change(screen.getByLabelText("Function"), { target: { value: "add" } });
    fireEvent.change(screen.getByLabelText(/^n/), { target: { value: "  " } });
    act(() => vi.advanceTimersByTime(500));
    await flush();
    expect(simulate).not.toHaveBeenCalled();
    expect(screen.getByText(/enter a value for/i)).toBeInTheDocument();
  });

  it("shows simulation errors and states that nothing is submitted", async () => {
    const simulate = vi.fn().mockResolvedValue({ ok: false, error: "HostError: boom" });
    render(<ContractPlayground contractId="C1" simulate={simulate} />);
    expect(screen.getByText(/no transaction is ever submitted/i)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Function"), { target: { value: "ping" } });
    act(() => vi.advanceTimersByTime(500));
    await flush();
    expect(screen.getByText("HostError: boom")).toBeInTheDocument();
  });
});
